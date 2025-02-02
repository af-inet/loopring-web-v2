import styled from '@emotion/styled';
import { Avatar, Box, Card, Grid, Modal as MuiModal, Typography } from '@mui/material';
import React from 'react';
import { WithTranslation, withTranslation } from 'react-i18next';
import { EmptyDefault, ModalCloseButton, SwitchPanelStyled } from '@loopring-web/component-lib';
import { useMyNFT } from './hook';
import { NFTDetail } from './detail';


const StyledPaper = styled(Box)`
  //width: 100%;
  //height: 100%;
  background: var(--color-box);
  border-radius: ${({theme}) => theme.unit}px;
`

const CardStyle = styled(Card)`
  background: var(--color-global-bg);
  width: 100%;
  cursor: pointer;
  height: 0;
  padding: 0;
  padding-bottom: calc(100% + 80px);
  position: relative;

  img {
    //width: 100%;
    object-fit: contain
  }

  //margin: 50px;
` as typeof Card

// const PopCard = styled(Card)`
//   background:var(--color-global-bg);
//   width: 100%;
//   cursor: pointer;
//   height: 0;
//   padding: 0;
//   padding-bottom: calc(100% + 80px);
//   position: relative;
//   //margin: 50px;
// ` as typeof Card


// const PopImgBlock = styled(Card)`
//     background:var(--color-global-bg);
//     width: 100%;
//     cursor: pointer;
//     height: 0;
//     padding: 0;
//     padding-bottom: calc(100% + 80px);
//     position: relative;
//   //margin: 50px;
// ` as typeof Card

export const MyNFTPanel = withTranslation('common')(({t, ...rest}: & WithTranslation) => {
    // const {resetKeypair,} = useResetAccount()
    // const {setShowFeeSetting} = useOpenModals()
    // const {exportAccount} = useExportAccountInfo()
    // const {etherscanBaseUrl} = useSystem();

    const {
        // showDeposit,
        popItem,
        onDetail,
        onDetailClose,
        isShow,
        nftList,
        etherscanBaseUrl,
    } = useMyNFT()

    const modalContent = React.useMemo(() => {
        return popItem && <NFTDetail etherscanBaseUrl={etherscanBaseUrl} onDetailClose={onDetailClose} popItem={popItem}/>
    }, [popItem, etherscanBaseUrl,onDetailClose])
    return <StyledPaper flex={1} className={'MuiPaper-elevation2'} marginTop={0} marginBottom={2}>
        <MuiModal
            open={isShow}
            onClose={onDetailClose}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >
            <SwitchPanelStyled width={'80%'} position={'relative'} minWidth={1000}
                               style={{alignItems: 'stretch'}}>
                {/*<Box display={'flex'} width={"100%"} flexDirection={'column'}>*/}
                {/*    <ModalCloseButton onClose={onClose} {...rest} />*/}
                {/*    /!*{onBack ? <ModalBackButton onBack={onBack}  {...rest}/> : <></>}*!/*/}
                {/*</Box>*/}
                {/*<Box className={'trade-panel'}>*/}
                {/*    {content}*/}
                {/*</Box>*/}
                <Box display={'flex'} width={"100%"} flexDirection={'column'}>
                    <ModalCloseButton onClose={onDetailClose} t={t} {...rest} />
                    {/*{onBack ? <ModalBackButton onBack={onBack}  {...rest}/> : <></>}*/}
                </Box>
                <Box display={'flex'} flexDirection={'row'} flex={1} justifyContent={'stretch'}>
                    {modalContent}
                </Box>

            </SwitchPanelStyled>
        </MuiModal>
        <Typography paddingX={3} paddingY={3} component={'h3'}
                    variant={'h5'}>{t('labelNFTMyNFT', {num: 0})}</Typography>
        {nftList && nftList.length ? <Grid container spacing={2} paddingX={3} paddingBottom={3}>
            {nftList.map((item, index) => <Grid key={item?.nftId??'' + index} item xs={12} md={6} lg={4} flex={'1 1 120%'}>
                <CardStyle sx={{maxWidth: 345}} onClick={() => {
                    onDetail(item)
                }}>
                    <Box position={'absolute'}
                         width={'100%'} height={'100%'} display={'flex'} flexDirection={'column'}
                         justifyContent={'space-between'}>
                        <Box flex={1} style={{background: "var(--field-opacity)"}} display={'flex'}
                             alignItems={'center'}
                             justifyContent={'center'}>
                            <img alt={'NFT'} width={'100%'} height={'100%'} src={item?.image}/></Box>
                        <Box padding={2} height={80} display={'flex'}
                             flexDirection={'row'} alignItems={'center'} justifyContent={'space-between'}>
                            <Box display={'flex'} flexDirection={'column'}>
                                <Typography
                                    color={'text.secondary'}
                                    component={'h6'}>{item?.name}</Typography>
                                <Typography color={'--color-text-primary'}
                                            component={'p'} paddingTop={1}
                                            title={item?.tokenId?.toString()}>
                                    {t('labelNFTTokenID')} #{item?.tokenId}
                                    {/*#{item.nftId.length > 10 ? getFormattedHash(item.nftId) : item.nftId}*/}
                                </Typography>
                            </Box>

                           <Box display={'inline-flex'}  alignItems={'center'}>
                               <Typography variant={'h4'}
                                           component={'div'}
                                           height={40} paddingX={3}  display={'inline-flex'}
                                           alignItems={'center'}  color={'textPrimary'}
                                   style={{background:'var(--field-opacity)',
                                       borderRadius:'20px'}}
                               >
                                   × {item.total}</Typography>
                               {/*<Typography variant={'h4'}*/}
                               {/*            component={'div'}*/}
                               {/*            height={24}  display={'inline-flex'}*/}
                               {/*            alignItems={'center'}  color={'textPrimary'}*/}
                               {/*            paddingRight={1}*/}
                               {/*    // style={{background:'var(--color-box)',*/}
                               {/*    //     borderRadius:'50%'}}*/}
                               {/*> × </Typography>*/}
                               {/*<Avatar sx={{background:'var(--field-opacity)'}} aria-label="recipe">*/}
                               {/*    */}
                               {/*</Avatar>*/}
                           </Box>
                        </Box>
                    </Box>
                </CardStyle>
            </Grid>)}
        </Grid> : <EmptyDefault message={() =>
            <Box flex={1} display={'flex'} alignItems={'center'} justifyContent={'center'}>No NFT</Box>}/>}

        {/*<Typography variant={'h5'} component={'h3'} paddingLeft={2}>{t('labelNFTTitleMyNFT')}</Typography>*/}
        {/*<Modal>*/}
    </StyledPaper>
})

//     <Link variant={'h5'}
// onClick={() => window.open(`${tradeData.etherscanBaseUrl}tx/${tradeData.tokenAddress}`)}>
// {getFormattedHash(tradeData.tokenAddress)}
// </Link>
// <Typography variant={'body1'} onClick={()=>onCopy(tradeData.nftId as string)}>
// <Typography component={'span'} color={'text.secondary'} >ID: </Typography>
// <Typography component={'span'} color={'text.secondary'}  title={tradeData.nftId}>{getFormattedHash(tradeData.nftId)} </Typography>
// </Typography>
