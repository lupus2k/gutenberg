/**
 * External dependencies
 */
import { View, Platform, TouchableWithoutFeedback } from 'react-native';

/**
 * WordPress dependencies
 */
import { Component } from '@wordpress/element';
import { withDispatch, withSelect } from '@wordpress/data';
import { compose, withPreferredColorScheme } from '@wordpress/compose';
import { createBlock } from '@wordpress/blocks';
import {
	KeyboardAwareFlatList,
	ReadableContentView,
	WIDE_ALIGNMENTS,
	alignmentHelpers,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import styles from './style.scss';
import BlockListAppender from '../block-list-appender';
import BlockListItem from './block-list-item';
import BlockListItemCell from './block-list-item-cell';
import {
	BlockListProvider,
	BlockListConsumer,
	DEFAULT_BLOCK_LIST_CONTEXT,
} from './block-list-context';
import { BlockDraggableWrapper } from '../block-draggable';
import { store as blockEditorStore } from '../../store';

const identity = ( x ) => x;

const stylesMemo = {};
const getStyles = (
	isRootList,
	isStackedHorizontally,
	horizontalAlignment
) => {
	if ( isRootList ) {
		return;
	}
	const styleName = `${ isStackedHorizontally }-${ horizontalAlignment }`;
	if ( stylesMemo[ styleName ] ) {
		return stylesMemo[ styleName ];
	}
	const computedStyles = [
		isStackedHorizontally && styles.horizontal,
		horizontalAlignment && styles[ `is-aligned-${ horizontalAlignment }` ],
		styles.overflowVisible,
	];
	stylesMemo[ styleName ] = computedStyles;
	return computedStyles;
};

export class BlockList extends Component {
	constructor() {
		super( ...arguments );
		this.extraData = {
			parentWidth: this.props.parentWidth,
			renderFooterAppender: this.props.renderFooterAppender,
			renderAppender: this.props.renderAppender,
			onDeleteBlock: this.props.onDeleteBlock,
			contentStyle: this.props.contentStyle,
		};
		this.renderItem = this.renderItem.bind( this );
		this.renderBlockListFooter = this.renderBlockListFooter.bind( this );
		this.scrollViewInnerRef = this.scrollViewInnerRef.bind( this );
		this.addBlockToEndOfPost = this.addBlockToEndOfPost.bind( this );
		this.shouldFlatListPreventAutomaticScroll =
			this.shouldFlatListPreventAutomaticScroll.bind( this );
		this.shouldShowInnerBlockAppender =
			this.shouldShowInnerBlockAppender.bind( this );
		this.renderEmptyList = this.renderEmptyList.bind( this );
		this.getExtraData = this.getExtraData.bind( this );
		this.getCellRendererComponent =
			this.getCellRendererComponent.bind( this );

		this.onLayout = this.onLayout.bind( this );

		this.state = {
			blockWidth: this.props.blockWidth || 0,
		};
	}

	addBlockToEndOfPost( newBlock ) {
		this.props.insertBlock( newBlock, this.props.blockCount );
	}

	scrollViewInnerRef( ref ) {
		this.scrollViewRef = ref;
	}

	shouldFlatListPreventAutomaticScroll() {
		return this.props.isBlockInsertionPointVisible;
	}

	shouldShowInnerBlockAppender() {
		const { blockClientIds, renderAppender } = this.props;
		return renderAppender && blockClientIds.length > 0;
	}

	renderEmptyList() {
		return (
			<EmptyListComponentCompose
				rootClientId={ this.props.rootClientId }
				renderAppender={ this.props.renderAppender }
				renderFooterAppender={ this.props.renderFooterAppender }
			/>
		);
	}

	getExtraData() {
		const {
			parentWidth,
			renderFooterAppender,
			onDeleteBlock,
			contentStyle,
			renderAppender,
			gridProperties,
		} = this.props;
		const { blockWidth } = this.state;
		if (
			this.extraData.parentWidth !== parentWidth ||
			this.extraData.renderFooterAppender !== renderFooterAppender ||
			this.extraData.onDeleteBlock !== onDeleteBlock ||
			this.extraData.contentStyle !== contentStyle ||
			this.extraData.renderAppender !== renderAppender ||
			this.extraData.blockWidth !== blockWidth ||
			this.extraData.gridProperties !== gridProperties
		) {
			this.extraData = {
				parentWidth,
				renderFooterAppender,
				onDeleteBlock,
				contentStyle,
				renderAppender,
				blockWidth,
				gridProperties,
			};
		}
		return this.extraData;
	}

	getCellRendererComponent( { children, item, onLayout } ) {
		const { rootClientId } = this.props;
		return (
			<BlockListItemCell
				children={ children }
				clientId={ item }
				onLayout={ onLayout }
				rootClientId={ rootClientId }
			/>
		);
	}

	onLayout( { nativeEvent } ) {
		const { layout } = nativeEvent;
		const { blockWidth } = this.state;
		const { isRootList, maxWidth } = this.props;

		const layoutWidth = Math.floor( layout.width );
		if ( isRootList && blockWidth !== layoutWidth ) {
			this.setState( {
				blockWidth: Math.min( layoutWidth, maxWidth ),
			} );
		} else if ( ! isRootList && ! blockWidth ) {
			this.setState( { blockWidth: Math.min( layoutWidth, maxWidth ) } );
		}
	}

	render() {
		const { isRootList, isRTL } = this.props;
		// Use of Context to propagate the main scroll ref to its children e.g InnerBlocks.
		const blockList = isRootList ? (
			<BlockListProvider
				value={ {
					...DEFAULT_BLOCK_LIST_CONTEXT,
					scrollRef: this.scrollViewRef,
				} }
			>
				<BlockDraggableWrapper isRTL={ isRTL }>
					{ ( { onScroll } ) => this.renderList( { onScroll } ) }
				</BlockDraggableWrapper>
			</BlockListProvider>
		) : (
			<BlockListConsumer>
				{ ( { scrollRef } ) =>
					this.renderList( {
						parentScrollRef: scrollRef,
					} )
				}
			</BlockListConsumer>
		);

		return blockList;
	}

	renderList( extraProps = {} ) {
		const {
			clearSelectedBlock,
			blockClientIds,
			title,
			header,
			isReadOnly,
			isRootList,
			horizontal,
			marginVertical = styles.defaultBlock.marginTop,
			marginHorizontal = styles.defaultBlock.marginLeft,
			isFloatingToolbarVisible,
			isStackedHorizontally,
			horizontalAlignment,
			contentResizeMode,
			blockWidth,
		} = this.props;
		const { parentScrollRef, onScroll } = extraProps;

		const { blockToolbar, headerToolbar, floatingToolbar } = styles;

		const containerStyle = {
			flex: isRootList ? 1 : 0,
			// We set negative margin in the parent to remove the edge spacing between parent block and child block in ineer blocks.
			marginVertical: isRootList ? 0 : -marginVertical,
			marginHorizontal: isRootList ? 0 : -marginHorizontal,
		};

		const isContentStretch = contentResizeMode === 'stretch';
		const isMultiBlocks = blockClientIds.length > 1;
		const { isWider } = alignmentHelpers;
		const extraScrollHeight =
			headerToolbar.height +
			blockToolbar.height +
			( isFloatingToolbarVisible ? floatingToolbar.height : 0 );

		const scrollViewStyle = [
			{ flex: isRootList ? 1 : 0 },
			! isRootList && styles.overflowVisible,
		];

		return (
			<View
				style={ containerStyle }
				onAccessibilityEscape={ clearSelectedBlock }
				onLayout={ this.onLayout }
				testID="block-list-wrapper"
			>
				<KeyboardAwareFlatList
					{ ...( Platform.OS === 'android'
						? { removeClippedSubviews: false }
						: {} ) } // Disable clipping on Android to fix focus losing. See https://github.com/wordpress-mobile/gutenberg-mobile/pull/741#issuecomment-472746541
					accessibilityLabel="block-list"
					innerRef={ ( ref ) => {
						this.scrollViewInnerRef( parentScrollRef || ref );
					} }
					extraScrollHeight={ extraScrollHeight }
					keyboardShouldPersistTaps="always"
					scrollViewStyle={ scrollViewStyle }
					extraData={ this.getExtraData() }
					scrollEnabled={ isRootList }
					contentContainerStyle={ [
						horizontal && styles.horizontalContentContainer,
						isWider( blockWidth, 'medium' ) &&
							( isContentStretch && isMultiBlocks
								? styles.horizontalContentContainerStretch
								: styles.horizontalContentContainerCenter ),
					] }
					style={ getStyles(
						isRootList,
						isStackedHorizontally,
						horizontalAlignment
					) }
					data={ blockClientIds }
					keyExtractor={ identity }
					renderItem={ this.renderItem }
					CellRendererComponent={ this.getCellRendererComponent }
					shouldPreventAutomaticScroll={
						this.shouldFlatListPreventAutomaticScroll
					}
					title={ title }
					ListHeaderComponent={ header }
					ListEmptyComponent={ ! isReadOnly && this.renderEmptyList }
					ListFooterComponent={ this.renderBlockListFooter }
					onScroll={ onScroll }
				/>
				{ this.shouldShowInnerBlockAppender() && (
					<View
						style={ {
							marginHorizontal:
								marginHorizontal -
								styles.innerAppender.marginLeft,
						} }
					>
						<BlockListAppender
							rootClientId={ this.props.rootClientId }
							renderAppender={ this.props.renderAppender }
							showSeparator
						/>
					</View>
				) }
			</View>
		);
	}

	renderItem( { item: clientId } ) {
		const {
			contentResizeMode,
			contentStyle,
			onAddBlock,
			onDeleteBlock,
			rootClientId,
			isStackedHorizontally,
			blockClientIds,
			parentWidth,
			marginVertical = styles.defaultBlock.marginTop,
			marginHorizontal = styles.defaultBlock.marginLeft,
			gridProperties,
		} = this.props;
		const { blockWidth } = this.state;

		// Extracting the grid item properties here to avoid
		// re-renders in the blockListItem component.
		const isGridItem = !! gridProperties;
		const gridItemProps = gridProperties && {
			numOfColumns: gridProperties.numColumns,
			tileCount: blockClientIds.length,
			tileIndex: blockClientIds.indexOf( clientId ),
		};
		return (
			<BlockListItem
				isStackedHorizontally={ isStackedHorizontally }
				rootClientId={ rootClientId }
				clientId={ clientId }
				parentWidth={ parentWidth }
				contentResizeMode={ contentResizeMode }
				contentStyle={ contentStyle }
				onAddBlock={ onAddBlock }
				marginVertical={ marginVertical }
				marginHorizontal={ marginHorizontal }
				onDeleteBlock={ onDeleteBlock }
				shouldShowInnerBlockAppender={
					this.shouldShowInnerBlockAppender
				}
				blockWidth={ blockWidth }
				isGridItem={ isGridItem }
				{ ...gridItemProps }
			/>
		);
	}

	renderBlockListFooter() {
		const paragraphBlock = createBlock( 'core/paragraph' );
		const {
			isReadOnly,
			withFooter = true,
			renderFooterAppender,
		} = this.props;

		if ( ! isReadOnly && withFooter ) {
			return (
				<>
					<TouchableWithoutFeedback
						accessibilityLabel={ __( 'Add paragraph block' ) }
						testID={ __( 'Add paragraph block' ) }
						onPress={ () => {
							this.addBlockToEndOfPost( paragraphBlock );
						} }
					>
						<View style={ styles.blockListFooter } />
					</TouchableWithoutFeedback>
				</>
			);
		} else if ( renderFooterAppender ) {
			return renderFooterAppender();
		}
		return null;
	}
}

export default compose( [
	withSelect(
		( select, { rootClientId, orientation, filterInnerBlocks } ) => {
			const {
				getBlockCount,
				getBlockHierarchyRootClientId,
				getBlockOrder,
				getSelectedBlockClientId,
				isBlockInsertionPointVisible,
				getSettings,
			} = select( blockEditorStore );

			const isStackedHorizontally = orientation === 'horizontal';

			const selectedBlockClientId = getSelectedBlockClientId();

			let blockClientIds = getBlockOrder( rootClientId );
			// Display only block which fulfill the condition in passed `filterInnerBlocks` function.
			if ( filterInnerBlocks ) {
				blockClientIds = filterInnerBlocks( blockClientIds );
			}

			const { maxWidth } = getSettings();
			const isReadOnly = getSettings().readOnly;

			const blockCount = getBlockCount();
			const rootBlockId = getBlockHierarchyRootClientId(
				selectedBlockClientId
			);

			const isFloatingToolbarVisible =
				!! selectedBlockClientId && !! getBlockCount( rootBlockId );
			const isRTL = getSettings().isRTL;

			return {
				blockClientIds,
				blockCount,
				isBlockInsertionPointVisible:
					Platform.OS === 'ios' && isBlockInsertionPointVisible(),
				isReadOnly,
				isRootList: rootClientId === undefined,
				isFloatingToolbarVisible,
				isStackedHorizontally,
				maxWidth,
				isRTL,
			};
		}
	),
	withDispatch( ( dispatch ) => {
		const { insertBlock, replaceBlock, clearSelectedBlock } =
			dispatch( blockEditorStore );

		return {
			clearSelectedBlock,
			insertBlock,
			replaceBlock,
		};
	} ),
	withPreferredColorScheme,
] )( BlockList );

class EmptyListComponent extends Component {
	render() {
		const {
			shouldShowInsertionPoint,
			rootClientId,
			renderAppender,
			renderFooterAppender,
		} = this.props;

		if ( renderFooterAppender || renderAppender === false ) {
			return null;
		}

		return (
			<View style={ styles.defaultAppender }>
				<ReadableContentView
					align={
						renderAppender
							? WIDE_ALIGNMENTS.alignments.full
							: undefined
					}
				>
					<BlockListAppender
						rootClientId={ rootClientId }
						renderAppender={ renderAppender }
						showSeparator={ shouldShowInsertionPoint }
					/>
				</ReadableContentView>
			</View>
		);
	}
}

const EmptyListComponentCompose = compose( [
	withSelect( ( select, { rootClientId, orientation } ) => {
		const {
			getBlockOrder,
			getBlockInsertionPoint,
			isBlockInsertionPointVisible,
		} = select( blockEditorStore );

		const isStackedHorizontally = orientation === 'horizontal';
		const blockClientIds = getBlockOrder( rootClientId );
		const insertionPoint = getBlockInsertionPoint();
		const blockInsertionPointIsVisible = isBlockInsertionPointVisible();
		const shouldShowInsertionPoint =
			! isStackedHorizontally &&
			blockInsertionPointIsVisible &&
			insertionPoint.rootClientId === rootClientId &&
			// If list is empty, show the insertion point (via the default appender)
			( blockClientIds.length === 0 ||
				// Or if the insertion point is right before the denoted block.
				! blockClientIds[ insertionPoint.index ] );

		return {
			shouldShowInsertionPoint,
		};
	} ),
] )( EmptyListComponent );
