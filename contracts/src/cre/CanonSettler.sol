// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReceiverTemplate} from "./vendor/ReceiverTemplate.sol";
import {CanonRegistry} from "../CanonRegistry.sol";

/// @title KOMA canon settler (Chainlink CRE receiver)
/// @notice Settles canon votes from a Chainlink CRE workflow (`cre/koma-canon`). Every node of the DON reads the
///         signed votes KOMA publishes, verifies each EIP-712 signature, re-reads each voter's weight from the coin
///         at the slot's snapshot, applies the tie rule and computes the votes root; the DON signs one report and
///         the Keystone forwarder delivers it here. This contract holds the registry's RELAYER_ROLE and calls
///         `CanonRegistry.finalize` for each settlement, so KOMA's server no longer decides the winner.
/// @dev Only the forwarder can call `onReport` (ReceiverTemplate); after deployment the owner can also pin the
///      workflow id and owner. A settlement the registry refuses (already finalized by the fallback keeper,
///      window still open, not a proposal) is skipped and logged, so one stale entry can't block the rest of
///      the batch. The registry is the source of truth for every check; this contract adds none of its own.
contract CanonSettler is ReceiverTemplate {
    struct Settlement {
        uint256 seriesId;
        uint256 episode;
        uint256 winnerIssueId;
        bytes32 votesRoot;
        uint256 winnerVotes;
        uint256 totalVotes;
    }

    CanonRegistry public immutable registry;
    uint256 public settledCount;

    event Settled(uint256 indexed seriesId, uint256 indexed episode, uint256 winnerIssueId, bytes32 votesRoot);
    event SettlementSkipped(uint256 indexed seriesId, uint256 indexed episode, bytes reason);

    error EmptyReport();

    constructor(address forwarder, CanonRegistry registry_) ReceiverTemplate(forwarder) {
        registry = registry_;
    }

    function _processReport(bytes calldata report) internal override {
        Settlement[] memory batch = abi.decode(report, (Settlement[]));
        if (batch.length == 0) revert EmptyReport();
        for (uint256 i; i < batch.length; ++i) {
            Settlement memory s = batch[i];
            try registry.finalize(s.seriesId, s.episode, s.winnerIssueId, s.votesRoot, s.winnerVotes, s.totalVotes) {
                ++settledCount;
                emit Settled(s.seriesId, s.episode, s.winnerIssueId, s.votesRoot);
            } catch (bytes memory reason) {
                emit SettlementSkipped(s.seriesId, s.episode, reason);
            }
        }
    }
}
