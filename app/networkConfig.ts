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
      votingPackageId: '0x71fdb31cdb9a251cbf6bab4659f0c137941552d4dc2b88404b122abbad943a90', // New package with PollRegistry
      votingRegistryId: '0x1ac79079e3607356b1b8ef6b2da3f75a4983e9969b5ed4e3fba3578e82f5f89b', // Team voting registry
      pollRegistryId: '0xc7f4811cd5a64e3429db53ba6e7a15d05ecdda2c1e00705aaec32e7223791d8e', // New poll registry
    }
  },
};

export const { useNetworkVariable, useNetworkVariables } = createNetworkConfig(networkConfig);
