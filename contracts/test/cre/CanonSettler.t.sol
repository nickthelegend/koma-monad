// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {LaunchpadFixture} from "../utils/LaunchpadFixture.sol";
import {BondingCurve} from "../../src/BondingCurve.sol";
import {SeriesCoin} from "../../src/SeriesCoin.sol";
import {CanonRegistry} from "../../src/CanonRegistry.sol";
import {CanonSettler} from "../../src/cre/CanonSettler.sol";
import {ReceiverTemplate} from "../../src/cre/vendor/ReceiverTemplate.sol";

contract CanonSettlerTest is LaunchpadFixture {
    uint256 id;
    BondingCurve curve;
    SeriesCoin coin;
    CanonSettler settler;
    address forwarder = makeAddr("forwarder");
    address whale = makeAddr("whale");
    uint64 constant WINDOW = 300;

    function setUp() public override {
        super.setUp();
        (id, curve, coin) = _launch(0, 0, WINDOW);
        _buy(curve, whale, 2e6);
        vm.warp(block.timestamp + 1);
        settler = new CanonSettler(forwarder, canon);
        bytes32 role = canon.RELAYER_ROLE();
        vm.prank(admin);
        canon.grantRole(role, address(settler));
        vm.startPrank(relayer);
        canon.propose(id, 11, whale);
        canon.propose(id, 12, whale);
        vm.stopPrank();
    }

    function _one(uint256 episode, uint256 winner, uint256 winnerVotes, uint256 total) internal view returns (bytes memory) {
        CanonSettler.Settlement[] memory b = new CanonSettler.Settlement[](1);
        b[0] = CanonSettler.Settlement(id, episode, winner, keccak256("votes"), winnerVotes, total);
        return abi.encode(b);
    }

    function test_SettlesThroughForwarder() public {
        vm.warp(block.timestamp + WINDOW);
        vm.expectEmit(address(canon));
        emit CanonRegistry.CanonFinalized(id, 1, 12, keccak256("votes"), 7, 9);
        vm.expectEmit(address(settler));
        emit CanonSettler.Settled(id, 1, 12, keccak256("votes"));
        vm.prank(forwarder);
        settler.onReport("", _one(1, 12, 7, 9));
        assertEq(canon.canonOf(id, 1), 12);
        assertEq(settler.settledCount(), 1);
        assertEq(canon.nextEpisode(id), 2);
    }

    function test_RevertWhen_NotForwarder() public {
        vm.warp(block.timestamp + WINDOW);
        vm.expectRevert(abi.encodeWithSelector(ReceiverTemplate.InvalidSender.selector, address(this), forwarder));
        settler.onReport("", _one(1, 12, 7, 9));
    }

    function test_RevertWhen_EmptyReport() public {
        vm.prank(forwarder);
        vm.expectRevert(CanonSettler.EmptyReport.selector);
        settler.onReport("", abi.encode(new CanonSettler.Settlement[](0)));
    }

    function test_SkipsWhileVotingOpen() public {
        vm.expectEmit(address(settler));
        emit CanonSettler.SettlementSkipped(id, 1, abi.encodeWithSelector(CanonRegistry.VotingOpen.selector, id, 1));
        vm.prank(forwarder);
        settler.onReport("", _one(1, 12, 7, 9));
        (,, bool finalized,,) = canon.slot(id, 1);
        assertFalse(finalized);
        assertEq(settler.settledCount(), 0);
    }

    function test_ReplayIsSkippedNotReverted() public {
        vm.warp(block.timestamp + WINDOW);
        vm.startPrank(forwarder);
        settler.onReport("", _one(1, 12, 7, 9));
        vm.expectEmit(address(settler));
        emit CanonSettler.SettlementSkipped(id, 1, abi.encodeWithSelector(CanonRegistry.AlreadyFinalized.selector, id, 1));
        settler.onReport("", _one(1, 11, 9, 9));
        vm.stopPrank();
        assertEq(canon.canonOf(id, 1), 12);
        assertEq(settler.settledCount(), 1);
    }

    function test_RegistryRulesStillApply() public {
        vm.warp(block.timestamp + WINDOW);
        vm.startPrank(forwarder);
        vm.expectEmit(address(settler));
        emit CanonSettler.SettlementSkipped(id, 1, abi.encodeWithSelector(CanonRegistry.NotAProposal.selector, 99));
        settler.onReport("", _one(1, 99, 1, 1));
        vm.expectEmit(address(settler));
        emit CanonSettler.SettlementSkipped(id, 1, abi.encodeWithSelector(CanonRegistry.InvalidTally.selector));
        settler.onReport("", _one(1, 12, 10, 9));
        vm.stopPrank();
        assertEq(settler.settledCount(), 0);
    }

    function test_WithoutRelayerRoleNothingSettles() public {
        bytes32 role = canon.RELAYER_ROLE();
        vm.prank(admin);
        canon.revokeRole(role, address(settler));
        vm.warp(block.timestamp + WINDOW);
        vm.prank(forwarder);
        settler.onReport("", _one(1, 12, 7, 9));
        assertEq(canon.canonOf(id, 1), 0);
    }

    function test_PinnedWorkflowIdRejectsOthers() public {
        settler.setExpectedWorkflowId(keccak256("koma-canon"));
        vm.warp(block.timestamp + WINDOW);
        bytes memory metadata = abi.encodePacked(keccak256("other"), bytes10(0), address(0));
        vm.prank(forwarder);
        vm.expectRevert(abi.encodeWithSelector(ReceiverTemplate.InvalidWorkflowId.selector, keccak256("other"), keccak256("koma-canon")));
        settler.onReport(metadata, _one(1, 12, 7, 9));
    }

    function testFuzz_BatchSettlesEveryDueSeries(uint8 n) public {
        n = uint8(bound(n, 1, 5));
        uint256[] memory ids = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            (uint256 sid, BondingCurve c,) = _launch(0, 0, WINDOW);
            _buy(c, whale, 2e6);
            ids[i] = sid;
        }
        vm.warp(block.timestamp + 1);
        vm.startPrank(relayer);
        for (uint256 i; i < n; ++i) canon.propose(ids[i], 100 + i, whale);
        vm.stopPrank();
        vm.warp(block.timestamp + WINDOW);
        CanonSettler.Settlement[] memory b = new CanonSettler.Settlement[](n);
        for (uint256 i; i < n; ++i) b[i] = CanonSettler.Settlement(ids[i], 1, 100 + i, bytes32(i), i, i + 1);
        vm.prank(forwarder);
        settler.onReport("", abi.encode(b));
        assertEq(settler.settledCount(), n);
        for (uint256 i; i < n; ++i) assertEq(canon.canonOf(ids[i], 1), 100 + i);
    }
}
