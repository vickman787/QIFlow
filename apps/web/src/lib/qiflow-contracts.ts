export const QIE_MAINNET_CHAIN_ID = 1990;

export const QIE_MAINNET_RPC = 'https://rpc2mainnet.qie.digital';

export const QIE_MAINNET_EXPLORER = 'https://mainnet.qie.digital';

export const NATIVE_QIE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const QIFLOW_CONTRACTS = {
  QIFlowToken: '0x8aff94408452a31e9D566468cf76fCA155c7538F',
  InterestRateModel: '0xBc59a7Fe22f2D56A6F7F0B7ab996C46c94Bbeb91',
  QIFlowOracle: '0xA51482Fdd51355165dd81e770EAA072354831C97',
  QIFlowPool: '0xc2BFd5E003c605CF39f66C01313856a06a9d3eE0',
  QIFlowRewards: '0xeC074a54D83211C85616dAC6a3FFfD1676164DB1',
  QIFlowLens: '0xab93914Fd4adcFA2f188c4EA2B85a417eD565b6e',
} as const;

export type QIFlowContractName = keyof typeof QIFLOW_CONTRACTS;
