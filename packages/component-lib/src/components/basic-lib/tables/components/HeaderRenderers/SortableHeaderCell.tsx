import { HeaderRendererProps } from 'react-data-grid';
// import { DropDownIcon } from '@loopring-web/common-resources';
import styled from '@emotion/styled'
import { Box, BoxProps } from '@material-ui/core'
import { css } from '@emotion/react';
import React from 'react';

// export interface LoopringTBHeaderProps<R> extends HeaderRendererProps<R> {
//     child?: React.ElementType<any> | JSX.Element,
// }

// const StyledCellContentWrapper = styled(Box)`
//   display: flex;
//   align-items: center;
//   cursor: pointer;
// `
export const headerSortCell = css`
  cursor: pointer;
  display: flex;
`;
export const headerSortName = css`
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
`;
const StyledArrowSort = styled(Box)<BoxProps & { sortdirection: 'ASC' | 'DESC' | undefined }>`
  margin-left: ${({theme}) => `${theme.unit / 2}px`};

  .up {
    width: 0;
    height: 0;
    border: ${({theme}) => `${theme.unit / 2}px`} solid transparent;
    border-bottom-color: ${({
                              theme,
                              sortdirection
                            }) => sortdirection === 'ASC' ? `${theme.colorBase.textPrimary}` : `${theme.colorBase.primary}`};
  }

  .down {
    width: 0;
    height: 0;
    border: ${({theme}) => `${theme.unit / 2}px`} solid transparent;
    border-top-color: ${({
                           theme,
                           sortdirection
                         }) => sortdirection === 'DESC' ? `${theme.colorBase.textPrimary}` : `${theme.colorBase.primary}`};
    margin-top: ${({theme}) => `${theme.unit / 4}px`};
  }
` as (props: BoxProps & { sortdirection: 'ASC' | 'DESC' | undefined }) => JSX.Element;

export const ArrowSort: React.ElementType<BoxProps
    & { sortDirection: 'ASC' | 'DESC' | undefined }> = ({
                                                            sortDirection,
                                                            // children,
                                                            ...rest
                                                        }: BoxProps & { sortDirection: 'ASC' | 'DESC' | undefined }) => {

    return <StyledArrowSort {...{...rest}} sortdirection={sortDirection}>
        <div className="up"/>
        <div className="down"/>
    </StyledArrowSort>
};


// type SharedHeaderCellProps<R, SR> = Pick<
//     HeaderRendererProps<R, SR>,
//     'sortDirection' | 'onSort' | 'priority'
//     >;
export interface SortableHeaderCellProps<R, SR = unknown> extends HeaderRendererProps<R, SR> {
    children?: React.ReactNode;
}

export function SortableHeaderCell<R, SR>({
                                              column,
                                              sortDirection,
                                              priority,
                                              onSort,
                                              children
                                          }: SortableHeaderCellProps<R, SR>) {
    // let sortText = '';
    // if (sortDirection === 'ASC') {
    //     sortText = '\u25B2';
    // } else if (sortDirection === 'DESC') {
    //     sortText = '\u25BC';
    // }
    if (column.sortable) {
        // const showUp = sortDirection === 'ASC'
        // const showDown =  sortDirection === 'DESC'

        return (
            <Box component={'span'} display={'flex'} alignItems={'center'}
                 className={`rdg-header-sort-cell ${headerSortCell}`}
                 onClick={(e: React.MouseEvent) => onSort(e.ctrlKey)}>
                <span className={`rdg-header-sort-name ${headerSortName}`}>{children ? children : column.name}</span>
                <ArrowSort {...{sortDirection}}/>
                {priority}
            </Box>

        );
    } else {
        return <>{children ? children : column.name}</>;
    }


}