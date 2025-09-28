import { getFullnodeUrl } from "@mysten/sui/client";
import {
  DEVNET_COUNTER_PACKAGE_ID,
  TESTNET_COUNTER_PACKAGE_ID,
  MAINNET_COUNTER_PACKAGE_ID,
} from "./constants";
import { createNetworkConfig } from "@mysten/dapp-kit";

export const networkConfig = {
  mainnet: {
    url: getFullnodeUrl('mainnet'),
    variables: {
      votingPackageId: '0xTODO_REPLACE_WITH_YOUR_VOTING_PACKAGE_ID',
      votingRegistryId: '0xTODO_REPLACE_WITH_YOUR_VOTING_REGISTRY_ID',
      pollRegistryId: '0xTODO_REPLACE_WITH_YOUR_POLL_REGISTRY_ID',
    }
  },
  testnet: {
    url: getFullnodeUrl('testnet'),
    variables: {
      votingPackageId: '0x0e9c865803a828baeab8c9d4088a9b60565b354b78d1ed22fd6dc1f9d31cab18',
      votingRegistryId: '0xa3f9d812fc532ab1c208fae39be7b8607539835dc24ac79f6e5fc35ca11787eb',
      pollRegistryId: '0xTODO_REPLACE_WITH_YOUR_POLL_REGISTRY_ID',
    }
  },
  devnet: {
    url: getFullnodeUrl('devnet'),
    variables: {
      votingPackageId: '0xa9904399c92edf750a34f7a7018c67e356270a09cfb86c91243afb3f18544e88', // Fresh deployment - all polls reset
      votingRegistryId: '0x42599a46877871145418c5106d5acbf2e1f573768bdc1c9304d6030e9f271cd9', // New registry
      pollRegistryId: '0x1cb2788134f00fa5c6f921dd0dfebc95942409d16963152abd4b7097d71082b8', // New poll registry
    }
  },
};

export const { useNetworkVariable, useNetworkVariables } = createNetworkConfig(networkConfig);
