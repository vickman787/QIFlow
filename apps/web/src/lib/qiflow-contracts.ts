export const QIE_MAINNET_CHAIN_ID = 1990;

export const QIE_MAINNET_RPC = 'https://rpc2mainnet.qie.digital';

export const QIE_MAINNET_EXPLORER = 'https://mainnet.qie.digital';

export const NATIVE_QIE_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

export const QIFLOW_CONTRACTS = {
  QIFlowToken: '0x8aff94408452a31e9D566468cf76fCA155c7538F',
  InterestRateModel: '0xBc59a7Fe22f2D56A6F7F0B7ab996C46c94Bbeb91',
  QIFlowOracle: '0xA51482Fdd51355165dd81e770EAA072354831C97',
  QIFlowPool: '0x06A47cAdA87cC2ef4337678927493cf1287b68Ea',
  QIFlowRewards: '0xDFbb9BD9E2093EFE73388f1Ef83194FeF481D3c4',
  QIFlowLens: '0x5762Cc5fEc86A71aff70E1D12bCd3bE4062d2DF1',
} as const;

export type QIFlowContractName = keyof typeof QIFLOW_CONTRACTS;
