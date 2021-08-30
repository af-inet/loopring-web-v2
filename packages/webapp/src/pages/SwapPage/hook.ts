import {
    AccountStatus,
    CoinMap,
    fnType,
    IBData,
    SagaStatus,
    TradeCalcData,
    TradeFloat,
    WalletMap,
} from '@loopring-web/common-resources';
import React from 'react';
import { LoopringAPI } from 'api_wrapper';
import { useTokenMap } from 'stores/token';
import * as sdk from 'loopring-sdk';
import { getExistedMarket, OrderStatus, sleep, TradeChannel } from 'loopring-sdk';

import { useAmmMap } from 'stores/Amm/AmmMap';
import { useWalletLayer2 } from 'stores/walletLayer2';
import { RawDataTradeItem, SwapData, SwapTradeData, SwapType, TradeBtnStatus, } from '@loopring-web/component-lib';
import { useAccount } from 'stores/account/hook';
import {
    accountStaticCallBack,
    btnClickMap,
    btnLabel,
    makeMarketArray,
    makeTickView,
    makeWalletLayer2,
    pairDetailBlock,
    pairDetailDone,
} from 'hooks/help';
import store from 'stores';
import { deepClone } from 'utils/obj_tools';
import { myError, myLog } from 'utils/log_tools';
import { useTranslation } from 'react-i18next';
import { usePairMatch } from 'hooks/common/usePairMatch';
import { useWalletLayer2Socket } from 'services/socket/';
import { useSocket } from 'stores/socket';
import { walletLayer2Service } from 'services/socket';
import { getTimestampDaysLater } from 'utils/dt_tools';
import { DAYS, REFRESH_RATE, TOAST_TIME } from 'defs/common_defs';

import { getShowStr, VolToNumberWithPrecision } from '../../utils/formatter_tool';
import { useToast } from 'hooks/common/useToast';
import { useAmount } from '../../stores/amount';

const useSwapSocket = () => {
    const {sendSocketTopic, socketEnd} = useSocket();
    const {account} = useAccount()
    React.useEffect(() => {
        if (account.readyState === AccountStatus.ACTIVATED) {
            sendSocketTopic({[ sdk.WsTopicType.account ]: true});
        } else {
            socketEnd()
        }
        return () => {
            socketEnd()
        }
    }, [account.readyState]);
}

enum PriceLevel {
    Normal,
    Lv1,
    Lv2,
}

const getPriceImpactInfo = (output: any) => {
    let priceImpact: any = output?.priceImpact ? parseFloat(output?.priceImpact) * 100 : undefined
    let priceImpactColor = 'var(--color-success)'

    let priceLevel = PriceLevel.Normal

    if (priceImpact) {

        if (priceImpact > 0.1 && priceImpact <= 1) {
            priceImpactColor = 'var(--color-success)'
        } else if (priceImpact > 1 && priceImpact <= 3) {
            priceImpactColor = 'var(--color-textPrimary)'
        } else if (priceImpact > 3 && priceImpact <= 5) {
            priceImpactColor = 'var(--color-warning)'
        } else if (priceImpact > 5 && priceImpact <= 10) {
            priceImpactColor = 'var(--color-error)'
            priceLevel = PriceLevel.Lv1
        } else if (priceImpact > 10) {
            priceImpactColor = 'var(--color-error)'
            priceLevel = PriceLevel.Lv2
        }

        priceImpact = getShowStr(priceImpact)

    } else {
        priceImpactColor = 'var(--color-textPrimary)'
    }

    return {
        priceImpact,
        priceImpactColor,
        priceLevel,
    }
}

export const useSwapPage = <C extends { [ key: string ]: any }>() => {
    useSwapSocket()
    //High: No not Move!!!!!!
    const {realPair, realMarket} = usePairMatch('/trading/lite');
    /** get store value **/
    const {amountMap, getAmount} =  useAmount();
    const {account, status: accountStatus} = useAccount()
    const {coinMap, tokenMap, marketArray, marketCoins, marketMap, idIndex} = useTokenMap()
    const {ammMap} = useAmmMap()
    const {status: walletLayer2Status} = useWalletLayer2();
    /*** api prepare ***/
    const {t} = useTranslation('common')
    const refreshRef = React.createRef();
    const [pair,setPair] =  React.useState(realPair);
    const [market, setMarket] = React.useState(realMarket);

    const [swapBtnI18nKey, setSwapBtnI18nKey] = React.useState<string | undefined>(undefined)
    const [swapBtnStatus, setSwapBtnStatus] = React.useState(TradeBtnStatus.AVAILABLE)
    const [isSwapLoading, setIsSwapLoading] = React.useState(true)
    const [quoteMinAmt, setQuoteMinAmt] = React.useState<string>()
    
    const { toastOpen, setToastOpen, closeToast, } = useToast()

    const [tradeData, setTradeData] = React.useState<SwapTradeData<IBData<C>> | undefined>(undefined);
    const [tradeCalcData, setTradeCalcData] = React.useState<Partial<TradeCalcData<C>>>({
        coinInfoMap: marketCoins?.reduce((prev: any, item: string | number) => {
            return {...prev, [ item ]: coinMap ? coinMap[ item ] : {}}
        }, {} as CoinMap<C>)
    });
    const [tradeArray, setTradeArray] = React.useState<RawDataTradeItem[]>([]);
    const [myTradeArray, setMyTradeArray] = React.useState<RawDataTradeItem[]>([]);
    const [tradeFloat, setTradeFloat] = React.useState<TradeFloat | undefined>(undefined);
    const [tickMap, setTickMap] = React.useState<sdk.LoopringMap<sdk.TickerData> | undefined>(undefined)
    const [ammPoolSnapshot, setAmmPoolSnapshot] = React.useState<sdk.AmmPoolSnapshot | undefined>(undefined);

    const [output, setOutput] = React.useState<any>()

    const [takerRate, setTakerRate] = React.useState<string>('0')

    const [feeBips, setFeeBips] = React.useState<string>('0')
    const [totalFee, setTotalFee] = React.useState<string>('0')

    const [depth, setDepth] = React.useState<sdk.DepthData>()

    const [alertOpen, setAlertOpen] = React.useState<boolean>(false)

    const [confirmOpen, setConfirmOpen] = React.useState<boolean>(false)

    const [priceImpact, setPriceImpact] = React.useState<number>(0)

    const debugInfo = process.env.NODE_ENV !== 'production' ? {
        tradeData,
        tradeCalcData: {coinBuy: tradeCalcData?.coinBuy, coinSell: tradeCalcData?.coinSell},
        priceImpact: output?.priceImpact,
        exceedDepth: output?.exceedDepth ?? false,
        amountBOutSlip: output?.amountBOutSlip ? JSON.stringify(output.amountBOutSlip) : '',
        market,
        quoteMinAmt,
    } : ''

    const swapFunc = React.useCallback(async (event: MouseEvent, isAgree?: boolean) => {

        setAlertOpen(false)
        setConfirmOpen(false)

        if (isAgree) {
            const {exchangeInfo} = store.getState().system
            setIsSwapLoading(true);
            if (!LoopringAPI.userAPI || !tokenMap || !exchangeInfo || !output
                || account.readyState !== AccountStatus.ACTIVATED) {

                setToastOpen({open: true, type: 'error', content: t('labelSwapFailed')})
                setIsSwapLoading(false)

                return
            }

            const sell = tradeData?.sell.belong as string
            const buy = tradeData?.buy.belong as string

            const baseToken = tokenMap[ sell ]
            const quoteToken = tokenMap[ buy ]

            const request: sdk.GetNextStorageIdRequest = {
                accountId: account.accountId,
                sellTokenId: baseToken.tokenId
            }

            const storageId = await LoopringAPI.userAPI.getNextStorageId(request, account.apiKey)

            try {

                const orderType = output.exceedDepth ? sdk.OrderType.ClassAmm : sdk.OrderType.TakerOnly
                const tradeChannel = output.exceedDepth ? TradeChannel.BLANK : sdk.TradeChannel.MIXED

                const request: sdk.SubmitOrderRequestV3 = {
                    exchange: exchangeInfo.exchangeAddress,
                    accountId: account.accountId,
                    storageId: storageId.orderId,
                    sellToken: {
                        tokenId: baseToken.tokenId,
                        volume: output.amountS
                    },
                    buyToken: {
                        tokenId: quoteToken.tokenId,
                        volume: output.amountBOutSlip.minReceived
                    },
                    allOrNone: false,
                    validUntil: getTimestampDaysLater(DAYS),
                    maxFeeBips: parseInt(totalFee),
                    fillAmountBOrS: false, // amm only false
                    orderType,
                    tradeChannel,
                    eddsaSignature: '',
                }

                myLog(request)

                const response = await LoopringAPI.userAPI.submitOrder(request, account.eddsaKey.sk, account.apiKey)

                myLog(response)

                if (!response?.hash) {
                    setToastOpen({open: true, type: 'error', content: t('labelSwapFailed')})
                    myError(response?.resultInfo)
                } else {
                    await sleep(TOAST_TIME)

                    const resp = await LoopringAPI.userAPI.getOrderDetails({ accountId: account.accountId, 
                        orderHash: response.hash}, account.apiKey)

                        myLog('-----> resp:', resp)

                    if (resp.orderDetail?.status !== undefined) {
                        switch(resp.orderDetail?.status) {
                            case OrderStatus.cancelled:
                                setToastOpen({open: true, type: 'warning', content: t('labelSwapCancelled')})
                                break
                            case OrderStatus.processed:
                                setToastOpen({open: true, type: 'success', content: t('labelSwapSuccess')})
                                break
                            default:
                                setToastOpen({open: true, type: 'error', content: t('labelSwapFailed')})
                        }
                    }
                    walletLayer2Service.sendUserUpdate()
                    setTradeData((state)=>{
                        return {
                            ...state,
                            sell: {...state?.sell, tradeValue: 0},
                            buy: {...state?.buy, tradeValue: 0},
                        } as SwapTradeData<IBData<C>>
                    } )
                }
            } catch (reason) {
                sdk.dumpError400(reason)
                setToastOpen({open: true, type: 'error', content: t('labelSwapFailed')})

            }

            setOutput(undefined)

            await sleep(REFRESH_RATE)

            setIsSwapLoading(false)

        }

    }, [account.readyState, output, tokenMap, tradeData, setOutput, setIsSwapLoading, setToastOpen, setTradeData])

    //table myTrade
    const myTradeTableCallback = React.useCallback(() => {
        if (market && account.accountId && account.apiKey && LoopringAPI.userAPI) {
            LoopringAPI.userAPI.getUserTrades({
                accountId: account.accountId,
                market,
            }, account.apiKey).then((response: {
                totalNum: any;
                userTrades: sdk.UserTrade[];
                raw_data: any;
            }) => {
                let _myTradeArray = makeMarketArray(market, response.userTrades) as RawDataTradeItem[]
                setMyTradeArray(_myTradeArray ? _myTradeArray : [])
            })
        } else {
            setMyTradeArray([])
        }

    }, [market, account.accountId, account.apiKey, setMyTradeArray])


    React.useEffect(() => {
        if (market && accountStatus === SagaStatus.UNSET && walletLayer2Status === SagaStatus.UNSET) {
            myTradeTableCallback();

        }
    }, [market, walletLayer2Status]);
    React.useEffect(() => {
        if(account.readyState === AccountStatus.ACTIVATED && accountStatus === SagaStatus.UNSET){
            getAmount({market})
            myTradeTableCallback();
        }
    },[accountStatus])

    //table marketTrade
    const marketTradeTableCallback = React.useCallback(() => {
        if (LoopringAPI.exchangeAPI) {
            LoopringAPI.exchangeAPI.getMarketTrades({market}).then(({marketTrades}: {
                totalNum: any;
                marketTrades: sdk.MarketTradeInfo[];
                raw_data: any;
            }) => {
                const _tradeArray = makeMarketArray(market, marketTrades)
                setTradeArray(_tradeArray as RawDataTradeItem[])
            })

        } else {
            setTradeArray([])
        }

    }, [market, setTradeArray,]);


    //Btn related function
    const btnLabelAccountActive = React.useCallback((): string | undefined => {
        const validAmt = (output?.amountBOut && quoteMinAmt
            && sdk.toBig(output?.amountBOut).gte(sdk.toBig(quoteMinAmt))) ? true : false;
        if (isSwapLoading) {
            setSwapBtnStatus(TradeBtnStatus.LOADING)
            return undefined
        } else {
            if (account.readyState === AccountStatus.ACTIVATED) {
                if (tradeData === undefined
                    || tradeData?.sell.tradeValue === undefined
                    || tradeData?.buy.tradeValue === undefined
                    || tradeData?.sell.tradeValue === 0
                    || tradeData?.buy.tradeValue === 0) {
                    setSwapBtnStatus(TradeBtnStatus.DISABLED)
                    return 'labelEnterAmount';
                } else if (validAmt || quoteMinAmt === undefined) {
                    setSwapBtnStatus(TradeBtnStatus.AVAILABLE)
                    return undefined

                } else {
                    const quote = tradeData?.buy.belong;
                    const minOrderSize = VolToNumberWithPrecision(quoteMinAmt, quote as any) + ' ' + tradeData?.buy.belong;
                    setSwapBtnStatus(TradeBtnStatus.DISABLED)
                    return `labelLimitMin, ${minOrderSize}`

                }

            } else {
                setSwapBtnStatus(TradeBtnStatus.AVAILABLE)
            }

        }
    }, [account.readyState, quoteMinAmt, tradeData, isSwapLoading, setSwapBtnStatus])

    const _btnLabel = Object.assign(deepClone(btnLabel), {
        [ fnType.ACTIVATED ]: [
            btnLabelAccountActive
        ]
    });

    React.useEffect(() => {
        if (accountStatus === SagaStatus.UNSET) {
            setSwapBtnStatus(TradeBtnStatus.AVAILABLE)
            setSwapBtnI18nKey(accountStaticCallBack(_btnLabel));
        }
    }, [accountStatus, isSwapLoading, tradeData?.sell.tradeValue])

    const swapCalculatorCallback = React.useCallback(async ({sell, buy, slippage, ...rest}: any) => {


        const {priceLevel} = getPriceImpactInfo(output)

        switch (priceLevel) {
            case PriceLevel.Lv1:
                setAlertOpen(true)
                break
            case PriceLevel.Lv2:
                setConfirmOpen(true)
                break
            default:
                swapFunc(undefined as any, true);
                break
        }

        myLog('swap directly')

    }, [output])

    const swapBtnClickArray = Object.assign(deepClone(btnClickMap), {
        [ fnType.ACTIVATED ]: [swapCalculatorCallback]
    })
    const onSwapClick = React.useCallback(({sell, buy, slippage, ...rest}: SwapTradeData<IBData<C>>) => {
        accountStaticCallBack(swapBtnClickArray, [{sell, buy, slippage, ...rest}])
    }, [swapBtnClickArray])
    //Btn related end

    React.useEffect(() => {
        if (accountStatus === SagaStatus.UNSET && tradeCalcData?.coinSell && tradeCalcData?.coinBuy) {
            walletLayer2Callback()
        }
    }, [ account.readyState, accountStatus, market, tradeCalcData?.coinSell, tradeCalcData?.coinBuy])

    const walletLayer2Callback = React.useCallback(async () => {
        // const base = tradeData?.sell.belong
        // const quote = tradeData?.buy.belong

        let walletMap:WalletMap<any>|undefined = undefined
        if (account.readyState === AccountStatus.ACTIVATED) {
            walletMap = makeWalletLayer2().walletMap;
            myLog('--ACTIVATED tradeCalcData:', tradeCalcData)
            setTradeData({
                ...tradeData,
                sell: {
                    belong: tradeCalcData.coinSell,
                    balance: walletMap ? walletMap[ tradeCalcData.coinSell as string ]?.count : 0
                },
                buy: {
                    belong: tradeCalcData.coinBuy,
                    balance: walletMap ? walletMap[ tradeCalcData.coinBuy as string ]?.count : 0
                },
            } as SwapTradeData<IBData<C>>)
            setTradeCalcData((tradeCalcData)=>{
               return  {...tradeCalcData, walletMap} as TradeCalcData<C>
            })
        } else {
            if(tradeCalcData.coinSell && tradeCalcData.coinBuy) {
                setTradeData((state)=>{
                    return {
                        ...state,
                        sell: {belong: tradeCalcData.coinSell},
                        buy: {belong: tradeCalcData.coinBuy},
                    } as SwapTradeData<IBData<C>>
                } )
            }
            setFeeBips('0')
            setTotalFee('0')
            setTakerRate('0')
            setTradeCalcData((state)=>{
                return  {...state,
                    minimumReceived: undefined,
                    priceImpact: undefined,
                    fee: undefined} 
            })
        }


    }, [tradeData, tradeCalcData, marketArray, ammMap, account.readyState])

    useWalletLayer2Socket({walletLayer2Callback})

    // myLog('tradeData?.sell.belong:', tradeData?.sell.belong)
    // myLog('tradeData?.buy.belong:', tradeData?.buy.belong)

    //HIGH: effect by wallet state update

    const handleSwapPanelEvent = async (swapData: SwapData<SwapTradeData<IBData<C>>>, swapType: any): Promise<void> => {

        // myLog('handleSwapPanelEvent...')

        const {tradeData} = swapData
        resetSwap(swapType, tradeData)

    }


    const apiCallback = React.useCallback(({depth, ammPoolsBalance, tickMap}) => {
        setDepth(depth)
        setTickMap(tickMap)
        setAmmPoolSnapshot(ammPoolsBalance)
        setIsSwapLoading(false)
    }, [setAmmPoolSnapshot, setTickMap, setDepth])

    const checkMarketDataValid = React.useCallback((ammPoolSnapshot,tickMap,market,depth) => {
        const hasAmm = (ammMap && ammMap['AMM' + market]) ?? false
        const checkCalcData = () => {
            const { market: marketTmp } = getExistedMarket(marketArray, tradeCalcData.coinSell, tradeCalcData.coinBuy)
            return marketTmp === market && ammPoolSnapshot && idIndex && idIndex[ ammPoolSnapshot.lp.tokenId ].replace('LP-', '') === market
        }
        return (hasAmm && ammPoolSnapshot !== undefined && checkCalcData()) || (!hasAmm && tickMap !== undefined) || (depth &&  depth.symbol ===  market)

    }, [ammMap, marketArray, tickMap, tradeCalcData.coinSell, tradeCalcData.coinBuy, ammPoolSnapshot, ])

    React.useEffect(() => {

        if (checkMarketDataValid(ammPoolSnapshot,tickMap,market,depth)) {
            refreshAmmPoolSnapshot(ammPoolSnapshot,tickMap,market,depth)
        }

    }, [depth, tradeCalcData.coinBuy])

    React.useEffect(() => {
        if (market) {
            //@ts-ignore
            myLog('refreshRef',market,refreshRef.current,refreshRef.current.firstElementChild);
            if(refreshRef.current ) {
                // @ts-ignore
                refreshRef.current.firstElementChild.click();
            }
            if ((tradeData && tradeData.sell.belong == undefined) || tradeData === undefined) {
                resetSwap(undefined, undefined)
            }
        }

    }, [market]);
    const refreshAmmPoolSnapshot = React.useCallback((ammPoolSnapshot,tickMap,_market,depth) => {
        //@ts-ignore
        myLog('ammPoolSnapshot',ammPoolSnapshot && idIndex[ ammPoolSnapshot.lp.tokenId ].replace('LP-', ''),market,tickMap)
        if ((tickMap || ammPoolSnapshot  )
            && market === _market
            && (`${tradeCalcData.coinSell}-${tradeCalcData.coinBuy}` === market
                || `${tradeCalcData.coinBuy}-${tradeCalcData.coinSell}` === market  )
         ) {
            let {stob} = pairDetailDone({
                coinKey: tradeData ? `${tradeCalcData.coinSell}-${tradeCalcData.coinBuy}` : market,
                market,
                ammPoolsBalance: (ammPoolSnapshot && idIndex && idIndex[ ammPoolSnapshot.lp.tokenId ].replace('LP-', '') === market)?  ammPoolSnapshot:undefined,
                tickerData: tickMap && tickMap[ _market ] ? tickMap[ _market ] : {},
                tokenMap,
                _tradeCalcData: tradeCalcData,
                coinMap,
                marketCoins,
                fee: totalFee,
                depth,
            })
            let _tradeFloat = makeTickView(tickMap && tickMap[ _market ] ? tickMap[ _market ] : {})
            setTradeFloat(_tradeFloat as TradeFloat);


            setTradeCalcData((state) => {
                state.StoB = getShowStr(stob)
                state.BtoS = getShowStr(stob ? 1 / stob : 0)
                return state
            })
        }

    }, [ market, totalFee, tradeData, tradeCalcData, setTradeCalcData])

    const resetTradeCalcData = React.useCallback((_tradeData, _market?, type?) => {
        if (coinMap && tokenMap && marketMap && marketArray && ammMap) {
            let coinA: string, coinB: string;
            if (_market) {
                [, coinA, coinB] = _market.match(/([\w,#]+)-([\w,#]+)/i);
            } else {
                coinA = '#null'
                coinB = '#null'
            }

            let whichCoinIndex = [coinA, coinB].findIndex(item => item !== '#null');

            if (whichCoinIndex !== -1 && coinMap[ [coinA, coinB][ whichCoinIndex ] ] === undefined) {
                whichCoinIndex === 0 ? coinA = 'LRC' : coinB = 'LRC';
            }
            if (whichCoinIndex === -1) {
                whichCoinIndex = 0;
                coinA = 'LRC';
            }
            if (type === 'sell' && coinB !== '#null') {
                if (!tokenMap[ coinA ].tradePairs.includes(coinB)) {
                    coinB = tokenMap[ coinA ].tradePairs[ 0 ]
                }
            } else if (coinB === '#null' || coinA === '#null') {
                if (!tokenMap[ [coinA, coinB][ whichCoinIndex ] ].tradePairs.includes([coinA, coinB][ whichCoinIndex ^ 1 ])) {
                    whichCoinIndex == 0 ? coinB = tokenMap[ [coinA, coinB][ whichCoinIndex ] ].tradePairs[ 0 ]
                        : coinA = tokenMap[ [coinA, coinB][ whichCoinIndex ] ].tradePairs[ 0 ];
                }
            }
            let walletMap:WalletMap<any>|undefined;

            if (account.readyState === AccountStatus.ACTIVATED && walletLayer2Status === SagaStatus.UNSET) {
                if (!Object.keys(tradeCalcData.walletMap ?? {}).length) {
                    walletMap = makeWalletLayer2().walletMap as WalletMap<any>;
                }
                walletMap = tradeCalcData.walletMap as WalletMap<any>;

            }

            const tradeDataTmp: any = {
                sell: {
                    belong: coinA,
                    tradeValue: _tradeData?.tradeValue ?? 0,
                    balance: walletMap ? walletMap[ coinA ]?.count : 0
                },
                buy: {
                    belong: coinB,
                    tradeValue: _tradeData?.tradeValue ?? 0,
                    balance: walletMap ? walletMap[ coinB ]?.count : 0
                }
            }

            const sellCoinInfoMap = tokenMap[ coinB ].tradePairs?.reduce((prev: any, item: string | number) => {
                return {...prev, [ item ]: coinMap[ item ]}
            }, {} as CoinMap<C>)

            const buyCoinInfoMap = tokenMap[ coinA ].tradePairs?.reduce((prev: any, item: string | number) => {
                return {...prev, [ item ]: coinMap[ item ]}
            }, {} as CoinMap<C>)


            setTradeCalcData((state)=>{
                return {
                    ...state,
                       walletMap,
                       coinSell: coinA,
                       coinBuy: coinB,
                       sellCoinInfoMap,
                       buyCoinInfoMap,
                       priceImpact: '',
                       priceImpactColor: 'inherit',
                       minimumReceived: '',
                       StoB:undefined,
                       BtoS:undefined,

                }
            })
            setTradeData({...tradeDataTmp})
            let {amm: ammKey, market: market} = sdk.getExistedMarket(marketArray, coinA, coinB);
            setAmmPoolSnapshot(()=>undefined);
            setTickMap(()=>undefined);
            setDepth(()=>undefined);
            setMarket(market);
            myLog('Market change getAmount',market)
            if(account.readyState === AccountStatus.ACTIVATED){
                getAmount({market})
                myTradeTableCallback();
            }
            setIsSwapLoading(true);
            setPair({coinAInfo: coinMap[ coinA ], coinBInfo: coinMap[ coinB ]})
            callPairDetailInfoAPIs();

        }

    }, [tradeCalcData, tradeData, coinMap, tokenMap, marketMap, marketArray, ammMap, totalFee, setTradeCalcData, setTradeData, setMarket, setPair,])

    const should15sRefresh = React.useCallback(() => {
        myLog('should15sRefresh',market);
        if (market) {
            // updateDepth()
            callPairDetailInfoAPIs()
            marketTradeTableCallback();
        }
    }, [market, setDepth, ammMap])
    const callPairDetailInfoAPIs = React.useCallback(() => {
        if (market && ammMap && LoopringAPI.exchangeAPI) {
            Promise.all([
                LoopringAPI.exchangeAPI.getMixDepth({market}),
                pairDetailBlock({coinKey: market, ammKey: `AMM-${market}` as string, ammMap})])
                .then(([{ depth }, { ammPoolsBalance, tickMap }]) => {
                    apiCallback({depth, ammPoolsBalance, tickMap })
                }, (reason: any) => {
                    myLog(reason)
                    throw Error(reason)
                }).catch((error) => {
                myLog(error, 'go to LER-ETH');
                resetTradeCalcData(undefined, market)
            })

        }

    }, [market, ammMap])

    const reCalculateDataWhenValueChange = React.useCallback((_tradeData, _market?, type?) => {

        myLog('########## _tradeData:', _tradeData)

        // @ts-ignore
        myLog('reCalculateDataWhenValueChange depth:', depth,  takerRate, checkMarketDataValid(ammPoolSnapshot,tickMap))
        if (checkMarketDataValid(ammPoolSnapshot,tickMap,market, depth) && depth && takerRate) {

            const coinA = _tradeData.sell.belong
            const coinB = _tradeData.buy.belong

            const isAtoB = type === 'sell'

            let input: any = (isAtoB ? _tradeData.sell.tradeValue : _tradeData.buy.tradeValue)
            input = input === undefined || isNaN(Number(input)) ? 0 : Number(input);
            let slippage = sdk.toBig(_tradeData.slippage && !isNaN(_tradeData.slippage) ? _tradeData.slippage : '0.5').times(100).toString();


            const inputParam = {
                input: input.toString(),
                base: coinA,
                quote: coinB,
                isAtoB,
                marketArr: marketArray as string[],
                tokenMap: tokenMap as any,
                marketMap: marketMap as any,
                depth,
                ammPoolSnapshot,
                feeBips,
                takerRate,
                slipBips: slippage
            }

            const output = sdk.getOutputAmount(inputParam)

            const priceImpact = getPriceImpactInfo(output)

            setPriceImpact(priceImpact.priceImpact ?? 0)

            let totalFee = undefined;
            const ammMarket = `AMM-${market}`

            if (amountMap && (amountMap[ammMarket] || amountMap[market]) && ammMap) {
                const amount = ammMap[ ammMarket ] ? amountMap[ammMarket] : amountMap[market]
                const quoteMinAmtInfo = amount[ _tradeData['buy'].belong as string ]
                myLog(`quoteMinAmtInfo: ${ammMarket}, ${_tradeData['buy'].belong}`)
                myLog(amountMap[ammMarket], amountMap[market])

                const takerRate = quoteMinAmtInfo.userOrderInfo.takerRate
                const feeBips = ammMap[ ammMarket ]? ammMap[ ammMarket ].__rawConfig__.feeBips : 0
                totalFee = sdk.toBig(feeBips).plus(sdk.toBig(takerRate)).toString();
                setQuoteMinAmt(quoteMinAmtInfo?.userOrderInfo.minAmount)
                setFeeBips(feeBips.toString())
                setTotalFee(totalFee)
                myLog(`${realMarket} feeBips:${feeBips} takerRate:${takerRate} totalFee: ${totalFee}`)

                setTakerRate(takerRate.toString())

            }
            const _tradeCalcData = {
                priceImpact: priceImpact.priceImpact,
                priceImpactColor: priceImpact.priceImpactColor,
                minimumReceived: getShowStr(output?.amountBOutSlip.minReceivedVal),
                fee: totalFee,
            }

            const tradeValue = getShowStr(output?.output)

            _tradeData[ isAtoB ? 'buy' : 'sell' ].tradeValue = tradeValue

            setOutput(output)
            setTradeCalcData({...tradeCalcData, ..._tradeCalcData});
            setTradeData({...tradeData, ..._tradeData});

        }


    }, [amountMap, depth, tradeCalcData, market, tradeData, coinMap, tokenMap, marketMap, marketArray, totalFee, ammPoolSnapshot])

    const resetSwap = (swapType: SwapType | undefined, _tradeData: SwapTradeData<IBData<C>> | undefined) => {
        switch (swapType) {
            case SwapType.SEll_CLICK:
            case SwapType.BUY_CLICK:
                return
            case SwapType.SELL_SELECTED:
                //type = 'sell'
                if (_tradeData?.sell.belong !== tradeData?.sell.belong) {
                    resetTradeCalcData(_tradeData, `${_tradeData?.sell?.belong ?? `#null`}-${_tradeData?.buy?.belong ?? `#null`}`, 'sell')
                } else {
                    reCalculateDataWhenValueChange(_tradeData, `${_tradeData?.sell.belong}-${_tradeData?.buy.belong}`, 'sell')
                }
                // throttleSetValue('sell', _tradeData)
                break
            case SwapType.BUY_SELECTED:
                //type = 'buy'
                if (_tradeData?.buy.belong !== tradeData?.buy.belong) {
                    resetTradeCalcData(_tradeData, `${_tradeData?.sell?.belong ?? `#null`}-${_tradeData?.buy?.belong ?? `#null`}`, 'buy')
                } else {
                    reCalculateDataWhenValueChange(_tradeData, `${_tradeData?.sell.belong}-${_tradeData?.buy.belong}`, 'buy')
                }
                break
            case SwapType.EXCHANGE_CLICK:

                const _tradeCalcData = {
                    ...tradeCalcData,
                    coinSell: tradeCalcData.coinBuy,
                    coinBuy: tradeCalcData.coinSell,
                    sellCoinInfoMap: tradeCalcData.buyCoinInfoMap,
                    buyCoinInfoMap: tradeCalcData.sellCoinInfoMap,
                    StoB: tradeCalcData.BtoS,
                    BtoS: tradeCalcData.StoB,
                    priceImpact: '',
                    priceImpactColor: 'inherit',
                    minimumReceived: '',
                    fee: ''
                }

                myLog('Exchange,tradeCalcData', tradeCalcData);
                myLog('Exchange,_tradeCalcData', _tradeCalcData);

                setTradeCalcData({..._tradeCalcData} as TradeCalcData<C>)

                setTradeData({...tradeData, ..._tradeData} as SwapTradeData<IBData<C>>);
                if (amountMap && market && _tradeData) {
                    const quoteMinAmtInfo = amountMap[market][ _tradeData['buy'].belong as string ]
                    setQuoteMinAmt(quoteMinAmtInfo?.userOrderInfo.minAmount)
                }

                break;
            default:
                myLog('resetSwap default')
                resetTradeCalcData(undefined, market)
                break
        }


    }
    return {
        toastOpen,
        closeToast,
        tradeCalcData,
        tradeFloat,
        tradeArray,
        myTradeArray,
        tradeData,
        pair,
        marketArray,
        onSwapClick,
        swapBtnI18nKey,
        swapBtnStatus: swapBtnStatus,
        handleSwapPanelEvent,
        should15sRefresh,
        refreshRef,
        alertOpen,
        confirmOpen,
        swapFunc,
        priceImpact,
        debugInfo,
        isSwapLoading,
    }

}