import { LoopringAPI } from 'api_wrapper'
import React from 'react'
import * as sdk from 'loopring-sdk'
import { TradingInterval } from 'loopring-sdk'
import { IOHLCData } from '@loopring-web/component-lib'
import { useTokenMap } from 'stores/token'
import { myLog } from '@loopring-web/common-resources'
import { VolToNumberWithPrecision } from 'utils/formatter_tool'

export function useKlineChart(market: string | undefined) {

    const { tokenMap } = useTokenMap()

    const [candlestickViewData, setCandlestickViewData] = React.useState<IOHLCData[]>([])

    const genCandlestickData = React.useCallback(async(market: string | undefined) => {

        if (market && LoopringAPI.exchangeAPI && tokenMap) {
        
            // @ts-ignore
            const [_, coinBase, coinQuote] = market.match(/(\w+)-(\w+)/i)

            myLog('coinBase:', coinBase)

            const decimals = tokenMap[coinBase] ? tokenMap[coinBase].decimals : -1

            if (decimals > 0) {
                const rep: sdk.GetCandlestickRequest = {
                    market,
                    interval: TradingInterval.d1
                }
    
                const candlesticks = await LoopringAPI.exchangeAPI.getMixCandlestick(rep)
    
                let candlestickViewData: IOHLCData[] = []
                
                candlesticks.candlesticks.forEach((item: sdk.Candlestick) => {
    
                    const dataItem: IOHLCData = {
                        date: new Date(item.timestamp),
                        open: item.open,
                        high: item.high,
                        low: item.low,
                        close: item.close,
                        volume: sdk.toBig(item.baseVol).div('1e' + decimals).toNumber()
                    }
    
                    candlestickViewData.push(dataItem)
    
                })
    
                setCandlestickViewData(candlestickViewData.reverse())

            } else {
                throw Error('wrong decimals')
            }
        
        }

    }, [tokenMap])

    React.useEffect(() => {
        genCandlestickData(market)
    }, [market, genCandlestickData])

    return {
        candlestickViewData,
        market,
        genCandlestickData,
    }
}
