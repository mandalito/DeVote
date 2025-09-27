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
      votingPackageId: '0x2280151e6f09a81aaffec74b11a9e2e7175907e255cbd68da0a0c5f26da4721b', // Package with dynamic polls
      votingRegistryId: '0x7f6145bf8e64d1e2944654571115b4ff18110da42839ed3ca25d4d5cb371851e', // Team voting registry
      pollRegistryId: '0x55d5647ec843e81d509be2b592ad5d093241d6c2ee094f010209932df54f1b5c', // Poll registry with dynamic support
    }
  },
};

export const { useNetworkVariable, useNetworkVariables } = createNetworkConfig(networkConfig);
