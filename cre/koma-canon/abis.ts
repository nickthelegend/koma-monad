import { parseAbi } from "viem";

export const canonAbi = parseAbi([
  "struct SeriesConfig { address coin; address characterNft; uint256 characterId; uint64 votingWindow; uint64 nextEpisode; }",
  "function slot(uint256 seriesId, uint256 episode) view returns (uint64 snapshot, uint64 endsAt, bool finalized, uint256 winner, uint256 proposalCount)",
  "function proposals(uint256 seriesId, uint256 episode) view returns (uint256[])",
  "function votingPower(uint256 seriesId, uint256 episode, address voter) view returns (uint256)",
  "function seriesConfig(uint256 seriesId) view returns (SeriesConfig)",
  "function canonOf(uint256 seriesId, uint256 episode) view returns (uint256)",
]);

export const erc721Abi = parseAbi(["function ownerOf(uint256 tokenId) view returns (address)"]);
