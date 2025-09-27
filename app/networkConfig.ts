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
    }
  },
  testnet: {
    url: getFullnodeUrl('testnet'),
    variables: {
      votingPackageId: '0x0e9c865803a828baeab8c9d4088a9b60565b354b78d1ed22fd6dc1f9d31cab18',
      votingRegistryId: '0xa3f9d812fc532ab1c208fae39be7b8607539835dc24ac79f6e5fc35ca11787eb',
    }
  },
  devnet: {
    url: getFullnodeUrl('devnet'),
    variables: {
      votingPackageId: '0x7fb658596502c14b013c91880e75c477234072c5f95ecfa1fed89dbb83452127', // Package with group helper functions
      votingRegistryId: '0x3acee036facf30c962ae2e3516f543a37613071d6e2528fc0331ce39c19af87e', // Team voting registry
      pollRegistryId: '0x7bb2df4bbe5d04165691d615cb90e2eb822614db33724c2c8a3adec1940b58f9', // Poll registry with group support
    }
  },
};

export const { useNetworkVariable, useNetworkVariables } = createNetworkConfig(networkConfig);
