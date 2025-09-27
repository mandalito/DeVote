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
      votingPackageId: '0x4737970cd05aa586aa2547cfa7563121dd7202136286cf8b4abf86b4dcf89829', // Package with group name/description helpers
      votingRegistryId: '0xd4c833d259ff065c399ecdee1b8b7e24ba15a53ad346e22dedf63726d92ef4ef', // Team voting registry
      pollRegistryId: '0x5252a191f2f8fbb6e18634e0b0c05854c91ce15cb191c0d1f0a242649dc625d5', // Poll registry with group details support
    }
  },
};

export const { useNetworkVariable, useNetworkVariables } = createNetworkConfig(networkConfig);
