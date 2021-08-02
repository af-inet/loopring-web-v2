import React from 'react';
import { useCustomDCEffect } from 'hooks/common/useCustomDCEffect';
import { useSystem } from './stores/system';
import { ChainId, sleep } from 'loopring-sdk';
import { useAmmMap } from './stores/Amm/AmmMap';
import { AccountStatus, SagaStatus } from '@loopring-web/common-resources';
import { useTokenMap } from './stores/token';
import { useWalletLayer1 } from './stores/walletLayer1';
import { useAccount } from './stores/account/hook';
import { connectProvides, ErrorType, useConnectHook } from '@loopring-web/web3-provider';
import { AccountStep, useOpenModals, WalletConnectStep } from '@loopring-web/component-lib';
import { LoopringAPI } from './stores/apis/api';
import { unlockAccount } from './hooks/unlockAccount';
import { myLog } from './utils/log_tools';

/**
 * @description
 * @step1 subscribe Connect hook
 * @step2 check the session storage ? choose the provider : none provider
 * @step3 decide china Id by step2
 * @step4 prepare the static date (tokenMap, ammMap, faitPrice, gasPrice, forex, Activities ...)
 * @step5 launch the page
 * @todo each step has error show the ErrorPage , next version for service maintain page.
 */

export function useInit() {
    const [state, setState] = React.useState<keyof typeof SagaStatus>('PENDING')
    // const systemState = useSystem();
    const tokenState = useTokenMap();
    const ammMapState = useAmmMap();
    const {
        updateSystem,
        chainId: _chainId,
        exchangeInfo,
        status: systemStatus,
        statusUnset: systemStatusUnset
    } = useSystem();
    const {account, updateAccount, resetAccount, statusUnset: statusAccountUnset} = useAccount();
    const {setShowConnect, setShowAccount} = useOpenModals();
    const walletLayer1State = useWalletLayer1()
    const handleChainChanged = React.useCallback(async (chainId) => {
        if (chainId !== _chainId && _chainId !== 'unknown' && chainId !== 'unknown') {
            chainId === 5 ? updateAccount({chainId}) : updateAccount({chainId: 1})
            updateSystem({chainId});
            window.location.reload();
        } else if (chainId == 'unknown') {
            //TODO show error
        }
    }, [_chainId])
    const handleConnect = React.useCallback(async ({
                                                       accounts,
                                                       chainId,
                                                       provider
                                                   }: { accounts: string, provider: any, chainId: number }) => {
        const accAddress = accounts[ 0 ];
        await handleChainChanged(chainId)
        // if (chainId !== _chainId && _chainId !== 'unknown') {
        //     chainId === 5 ? updateAccount({chainId}):updateAccount({chainId:1})
        //     updateSystem({chainId: chainId as ChainId});
        //     window.location.reload();
        // }  else if(chainId == 'unknown'){
        //     //TODO show error
        // }
        updateAccount({accAddress, readyState: AccountStatus.CONNECT, chainId: chainId as any});
        statusAccountUnset();
        setShowConnect({isShow: true, step: WalletConnectStep.SuccessConnect});

        //TODO if have account  how unlocl if not show
        if (connectProvides.usedWeb3 && exchangeInfo && LoopringAPI.exchangeAPI && LoopringAPI.userAPI) {
            // try {
            const {accInfo} = (await LoopringAPI.exchangeAPI.getAccount({
                owner: accAddress
            }));

            await sleep(1000)
            let activeDeposit = localStorage.getItem('activeDeposit');
            if (activeDeposit) {
                activeDeposit = JSON.stringify(activeDeposit);
            }

            if (accInfo && accInfo.accountId) {
                debugger
                await unlockAccount({accInfo})

            } else if (activeDeposit && activeDeposit[ accAddress ]) {
                debugger
                setShowConnect({isShow: false});
                setShowAccount({isShow: true, step: AccountStep.Depositing});
                updateAccount({readyState: AccountStatus.DEPOSITING});
            } else {
                debugger
                setShowConnect({isShow: false});
                setShowAccount({isShow: true, step: AccountStep.NoAccount});
                updateAccount({readyState: AccountStatus.NO_ACCOUNT});
            }
        }


    }, [_chainId, account])
    const handleAccountDisconnect = React.useCallback(async () => {
        if (account && account.accAddress) {
            resetAccount();
            statusAccountUnset();
            myLog('Disconnect and clear')
        } else {
            myLog('Disconnect with no account')
        }

    }, [account]);

    const handleError = React.useCallback(async ({type, errorObj}: { type: keyof typeof ErrorType, errorObj: any }) => {
        updateSystem({chainId: account.chainId ? account.chainId : 1})
        resetAccount();
        await sleep(10);
        statusAccountUnset();
        myLog('Error')
    }, [account]);

    useConnectHook({handleAccountDisconnect, handleError, handleConnect, handleChainChanged});
    useCustomDCEffect(async () => {
        // TODO getSessionAccount infor
        if (account.accAddress && account.connectName && account.connectName !== 'UnKnown' && account.accAddress) {
            try {
                await connectProvides[ account.connectName ]();
                if (connectProvides.usedProvide) {
                    const chainId = Number(await connectProvides.usedWeb3?.eth.getChainId());
                    updateSystem({chainId: (chainId && chainId === ChainId.GORLI ? chainId as ChainId : ChainId.MAINNET)})
                    return
                }
            } catch (error) {
                console.log(error)
            }
        } else if (account.chainId) {
            updateSystem({chainId: account.chainId})
        } else {
            updateSystem({chainId: ChainId.MAINNET})
        }

        //TEST:
        // await connectProvides.MetaMask();
        // if (connectProvides.usedProvide) {
        //     // @ts-ignore
        //     const chainId = Number(await connectProvides.usedProvide.request({method: 'eth_chainId'}))
        //     // // @ts-ignore
        //     //const accounts = await connectProvides.usedProvide.request({ method: 'eth_requestAccounts' })
        //     systemState.updateSystem({chainId: (chainId ? chainId as ChainId : ChainId.MAINNET)})
        //     return
        // }


    }, [])
    React.useEffect(() => {
        switch (systemStatus) {
            case "ERROR":
                systemStatusUnset();
                setState('ERROR')
                //TODO show error at button page show error  some retry dispat again
                break;
            case "DONE":
                systemStatusUnset();
                break;
            default:
                break;
        }
    }, [systemStatus, systemStatusUnset]);
    React.useEffect(() => {
        if (ammMapState.status === "ERROR" || tokenState.status === "ERROR") {
            //TODO: solve error
            ammMapState.statusUnset();
            tokenState.statusUnset();
            setState('ERROR');
        } else if (ammMapState.status === "DONE" && tokenState.status === "DONE") {
            ammMapState.statusUnset();
            tokenState.statusUnset();
            setState('DONE');
        }
    }, [ammMapState, tokenState, account.accountId, walletLayer1State])

    return {
        state,
    }

}

