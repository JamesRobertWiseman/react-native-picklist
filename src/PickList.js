import React from 'react';
import {
    DeviceEventEmitter,
    FlatList,
    Image,
    LayoutAnimation,
    SafeAreaView,
    SectionList,
    StyleSheet,
    View,
    Keyboard,
    Text
} from 'react-native';
import { HeaderButton } from 'react-navigation-header-buttons';
import {HeaderBackButton} from '@react-navigation/stack';
import SearchBar from 'react-native-general-searchbar';
import InitTree from 'general-tree';
import Cell from './Cell';
import TitleLine from './TitleLine';
import BottomBar from './BottomBar';
import ShowAllCell from './ShowAllCell';
import Types from './Types';
import { isCascade } from './Util';
import { getImage, single_check_image } from './DefaultRow';

export default class extends React.PureComponent {
    static navigationOptions = ({route}) => {
        const navParams = route.params || {};
        const {_title_, _right_, _left_, headerTitleContainerStyle} = navParams
        const returnDic = {};
        _title_ && (returnDic.title = _title_);
        headerTitleContainerStyle && (returnDic.headerTitleContainerStyle = headerTitleContainerStyle);
        if (_right_) {
            returnDic.headerRight = typeof _right_ ==  'function' ? _right_  : ()=>_right_;
        }
        if (_left_) {
            returnDic.headerLeft = typeof _left_ ==  'function' ? _left_ : _left_;
        }
        return returnDic;
    };

    static initialized = function ({route}) {
        const {_title_} = route.params;
        return !!_title_;
    };

    static propTypes = Types;

    static defaultProps = {
        isCascade: true,
        multilevel: false,
        multiselect: false,
        showSearchView: true,
        showTitleLine: true,
        showAllCell: true,
        showCount: false,
        numberOfTextLines: 0,
        directBackWhenSingle: true,
        cancelableWhenDirectBack: true,
        childrenKey: 'children',
        idKey: 'id',
        labelKey: 'label',
        labels: {
            close: 'Close',
            search: 'Search',
            selectAll: 'Select All',
            deselectAll: 'Deselect All',
            ok: 'OK',
            choose: 'Please Choose',
            cancel: 'Cancel',
        },
        renderSingleSelectIcon: () => <Image source={single_check_image()} style={styles.icon} />,
        renderMultiSelectIcon: (selectState) => <Image source={getImage(selectState)} style={styles.multiIcon} />,
        prefixTestID: '',
        refreshSingleCell: true
    };

    constructor(props) {
        super(props);
        const {data, firstRawRootPath, childrenKey, idKey, labelKey, firstTitleLine, selectedIds, refreshSingleCell, rootPath, parentPath, addedData} = props;
        this.defaultRootId = '__root__';
        const idOnlyKey = Array.isArray(idKey) ? idKey[0] : idKey;
        const treeRoot = Array.isArray(data) ?
            {[childrenKey]: data, [idOnlyKey]: this.defaultRootId, [labelKey]: firstTitleLine, 'firstRawRootPath': firstRawRootPath} :
            {[childrenKey]: [data], [idOnlyKey]: this.defaultRootId, [labelKey]: firstTitleLine, 'firstRawRootPath': firstRawRootPath};
        const tree = InitTree({
            root: treeRoot,
            childrenKey: childrenKey,
            idKey: idKey,
            onStatusChange: (treenode) => DeviceEventEmitter.emit(
                '__treenode__status__update__' + (refreshSingleCell ? treenode.getStringId() : '')
            ),
            rootPath: rootPath,
            parentPath: parentPath
        });
        this.isCascade = isCascade(props);
        let addedTrees = [];
        let selectItems = tree.setInitialState(selectedIds, this.isCascade);
        if (Array.isArray(addedData) && addedData.length > 0) {
            addedData.forEach(item => {
                const addedTreeRoot = {[childrenKey]: item, [idOnlyKey]: this.defaultRootId, [labelKey]: firstTitleLine, 'firstRawRootPath': firstRawRootPath};
                const addedTree = InitTree({
                    root: addedTreeRoot,
                    childrenKey: childrenKey,
                    idKey: idKey,
                    onStatusChange: (treenode) => DeviceEventEmitter.emit(
                        '__treenode__status__update__' + (refreshSingleCell ? treenode.getStringId() : '')
                    ),
                    rootPath: rootPath,
                    parentPath: parentPath
                });
                addedTrees.push(addedTree);
            });
            
            addedTrees.forEach(addedTree => {
                let tmp = addedTree.setInitialState(selectedIds, this.isCascade);
                selectItems = selectItems.concat(tmp);
            });
        }
        this.state = {
            levelItems: [tree],
            selectedItems: selectItems,
            searchText: '',
            isSearching: false,
            screenWidth: 0,
            addedLevelItems: addedTrees,
        };
    }

    componentDidMount() {
        const navOptions = {_title_: this.props.title};
        const {rightTitle, rightClick} = this.props;
        if (rightTitle && rightTitle.length > 0) {
            navOptions._right_ = (
                <HeaderButton
                    title={rightTitle}
                    onPress={rightClick || this._clickOK}
                />
            );
        } else if (!this.props.multiselect && !this.props.directBackWhenSingle) {
            navOptions._right_ = (
                <HeaderButton
                    title={this.props.labels.ok}
                    onPress={this._clickOK}
                    {...this.props.buttonProps}
                />
            );
        }
        if (this.props.multilevel) {
            navOptions._left_ = (props) => {
                return (
                    <View
                        style={styles.leftButtons}
                    >
                        <HeaderBackButton
                            {...props}
                            onPress={this._clickBack.bind(this, 0)}
                        />
                        <HeaderButton
                            title={this.props.labels.close}
                            onPress={this._clickBack.bind(this, 1)}
                            {...this.props.buttonProps}
                        />
                    </View>
                );
            };
        }
        navOptions.headerTitleContainerStyle = {
            marginHorizontal: 75,
        }
        this.props.navigation.setParams(navOptions);
    }

    render() {
        const hasBottom = this.props.showBottomView !== undefined ?
            this.props.showBottomView :
            this.props.multiselect;
        const hideEmpty = this.state.searchText && this.state.searchText.length > 0;
        return (
            <View style={styles.view}>
                {this.props.showSearchView && this._renderSearchBar()}
                <SafeAreaView style={styles.innersafeview}>
                    <View
                        style={{flex: 1, overflow: 'hidden'}}
                        onLayout={({nativeEvent: {layout: {width}}}) => {
                            if (width > 0 && width !== this.state.screenWidth) {
                                this.setState({
                                    screenWidth: width,
                                    frame: {
                                        top: 0,
                                        bottom: 0,
                                        left: 0 - (this.state.levelItems.length - 1) * width,
                                    }
                                });
                            }
                        }}
                    >
                        {!this.state.isSearching && this._renderHeader()}
                        {this.state.isSearching ? (hideEmpty ? this._renderSearchingView() : this._renderEmpty()) : this._renderPageView()}
                    </View>
                </SafeAreaView>
                {hasBottom && this._renderBottomView()}
            </View>
        );
    }

    _renderEmpty = () => (
        <View style={styles.emptyContainer}>
            <Image style={styles.emptyImage} source={require('./image/EmptySearch.png')} />
        </View>
    );

    _renderSearchBar = () => {
        const prefixTestID = this.props.prefixTestID || '';
        return (
            <SafeAreaView style={styles.searchbarContainer}>
                <SearchBar
                    textInputProps={{
                        testID: `${prefixTestID}Input`,
                    }}
                    placeholder={this.props.labels.search}
                    cancelText={this.props.labels.cancel}
                    searchText={this.state.searchText}
                    onPressCancel={() => {
                        LayoutAnimation.linear();
                        this.setState({isSearching: false, searchText: ''});
                    }}
                    onSubmitEditing={this._onSubmit}
                    onChangeText={this._onSearch}
                    canCancel={true}
                    isSearching={this.state.isSearching}
                    style = {{
                        view: {backgroundColor: '#F7F7F9'},
                        inputView: {backgroundColor: 'white'}
                    }}
                />
            </SafeAreaView>
        );
    };

    _onScroll(event) {
        Keyboard.dismiss();
    }

    _renderSearchingView = () => {
        const style = {width: this.state.screenWidth};
        const searchKeys = this.props.searchKeys || [];
        const data = this.state.levelItems[0].search(
            this.state.searchText,
            [...searchKeys, this.props.labelKey],
            this.props.multiselect,
            false,
            false
        );
        return (
            <View style={[styles.searchingViewContainer, style]}>
                <FlatList
                    key={this.state.searchText}
                    data={data}
                    renderItem={this._renderRow}
                    style={[styles.listview, style]}
                    contentContainerStyle={style}
                    keyExtractor={(item) => item.getStringId()}
                    keyboardShouldPersistTaps={'always'}
                    onScroll = {this._onScroll.bind(this)}
                    {...this.props.searchListProps}
                />
            </View>
        );
    };

    _renderBottomView = () => {
        return (
            <BottomBar
                {...this.props}
                selectedItems={this.state.selectedItems}
                onPress={this._clickOK}
                onPressItem={this._clickBottomItem}
            />
        );
    };

    _renderRow = ({item, isWeakNode}) => {
        return (
            <Cell
                {...this.props}
                isSearching={this.state.isSearching}
                treeNode={item}
                isWeakNode= {isWeakNode}
                onPress={this._clickRow}
            />
        );
    };

    _renderHeader = () => {
        if (this.props.renderHeader) {
            return this.props.renderHeader(this.state.selectedItems);
        } else {
            return this._renderTitleLine();
        }
    };

    _renderTitleLine = () => {
        const {multilevel, showTitleLine} = this.props;
        return multilevel && showTitleLine ? (
            <TitleLine
                {...this.props}
                ref={ref => this.titleLineScrollView = ref}
                levelItems={this.state.levelItems}
                onPress={(index) => this._handlePressToPrevPage(index)}
            />
        ) : undefined;
    };

    _renderShowAll = () => {
        return (
            <ShowAllCell
                {...this.props}
                treeNode={this.state.levelItems[this.state.levelItems.length - 1]}
                onPress={this._selectItem}
            />
        );
    };

    _renderPage = (index) => {
        const {split, sort, sectionListProps, flatListProps, showAllCell, customView} = this.props;
        const style = {width: this.state.screenWidth};
        const treeNode = this.state.levelItems[index];
        let nodeArr, isSection;
        if (split) {
            isSection = true;
            nodeArr = split(treeNode.getChildren());
        } else {
            isSection = false;
            nodeArr = treeNode.getChildren();
            if (sort) {
                nodeArr = nodeArr.sort(sort);
            }
        }
        const ListClass = isSection ? SectionList : FlatList;
        const dataProps = isSection ? {sections: nodeArr} : {data: nodeArr};
        const ListProps = isSection ? sectionListProps : flatListProps;
        const hasShowAll = isCascade(this.props) && showAllCell;

        const wrapRenderRow = (...params)=>{
            const obj = params[0];
            const {item} = obj;
            let isWeakNode = false;
            if (item.getWeakParent().indexOf(treeNode) >= 0) {
                isWeakNode = true;
            }   
            obj.isWeakNode = isWeakNode;
            return this._renderRow(...params)
        }
        return (customView ? customView(nodeArr, wrapRenderRow) :
            <ListClass
                key={index}
                renderItem={wrapRenderRow}
                ListHeaderComponent={hasShowAll && this._renderShowAll}
                style={[styles.listview, style]}
                contentContainerStyle={style}
                keyExtractor={(item) => item.getStringId()}
                {...dataProps}
                {...ListProps}
            />);
    };

    _renderEmptyPage = (index) => {
        return <View key={index} style={{width: this.state.screenWidth}} />;
    };

    _renderPageView = () => {
        const deepth = this.state.levelItems.length;
        const totalWidth = this.state.screenWidth * deepth;
        return (
            <View style={[{width: totalWidth}, styles.displayView, this.state.frame]}>
                {
                    new Array(deepth).fill(1).map((item, index) => {
                        if (index < this.state.levelItems.length) {
                            return this._renderPage(index);
                        } else {
                            return this._renderEmptyPage(index);
                        }
                    })
                }
            </View>
        );
    };

    getSelectedItems = () => {
        return [...this.state.selectedItems];
    };

    backToPreviousPage = () => {
        const curIndex = this.state.levelItems.length;
        if (curIndex <= 1) {
            return false;
        } else {
            this._handlePressToPrevPage(curIndex - 1);
            return true;
        }
    };

    _getCurrentSelectedIdKeys = (idKey = 'code') => {
        const { selectedItems } = this.state;
        let selectedCodes = [];
        let tmpSelectItems = [];
        if (selectedItems && selectedItems.length > 0) {
            tmpSelectItems = [[], ...selectedItems].reduce((prv, cur) => [...prv, ...cur.getLeafChildren()]);
            tmpSelectItems
                .filter((item) => item.isSelected == 1)
                .map((item) => {
                    if (selectedCodes.indexOf(item.root.info[idKey]) == -1) {
                        selectedCodes.push(item.root.info[idKey]);
                    }
                });
        }
        return selectedCodes;
    };

    _handlePressToPrevPage = (index) => {
        const levelItems = this.state.levelItems.slice(0, index);
        this._show(index - 1, levelItems);
    };

    _show = (index, levelItems) => {
        LayoutAnimation.easeInEaseOut();
        this.setState({
            levelItems,
            frame: {
                top: 0,
                bottom: 0,
                left: 0 - index * this.state.screenWidth,
            },
        });
    };

    _popToPrevious = () => {
        if (this.props.navigation && !this.backTime) {
            this.props.navigation.goBack();
            this.backTime = setTimeout(() => {
                clearTimeout(this.backTime)
                this.backTime = undefined;
            }, 1000);
        }
    };

    _clickBack = (index) => {
        if (index === 0) {
            const curIndex = this.state.levelItems.length;
            if (curIndex <= 1) {
                this._popToPrevious();
            } else {
                this._handlePressToPrevPage(curIndex - 1);
            }
        } else {
            this._popToPrevious();
        }
        this.props.onFinish && this.props.onFinish(this.state.selectedItems, true);
    };

    _clickOK = () => {
        this.props.onFinish && this.props.onFinish(this.state.selectedItems);
        this._popToPrevious();
    };

    _clickRow = (treeNode, isInternal = false) => {
        if (this.props.multilevel &&
            !isInternal &&
            !treeNode.isLeaf() &&
            !this.state.isSearching
        ) {
            const levelItems = [...this.state.levelItems, treeNode];
            this._show(this.state.levelItems.length, levelItems);
        } else {
            if (this.props.multiselect) {
                this._selectItem(treeNode);
            } else {
                if (treeNode.isFullSelect(this.isCascade)) {
                    if (this.props.directBackWhenSingle &&
                        !this.props.cancelableWhenDirectBack) {
                        this._clickOK();
                    } else {
                        treeNode.update(this.isCascade);
                        const selectedItems = [];
                        this.setState({selectedItems}, () => {
                            if (this.props.directBackWhenSingle) {
                                this._clickOK();
                            }
                        });
                    }
                } else {
                    if (this.state.selectedItems.length > 0 &&
                        !this.state.selectedItems[0].isEqual(treeNode)) {
                        this.state.selectedItems[0].update(this.isCascade);
                    }
                    treeNode.update(this.isCascade);
                    const selectedItems = [treeNode];
                    this.setState({selectedItems}, () => {
                        if (this.props.directBackWhenSingle) {
                            this._clickOK();
                        }
                    });
                }
            }
        }
    };

    _clickBottomItem = (index) => {
        const node = this.state.selectedItems[index];
        node.update(this.isCascade);
        this._updateSelectedItems();
    };

    _onSubmit = (event) => {
        const text = event ? event.nativeEvent.text : this.state.searchText;
        this.setState({
            isSearching: true,
            searchText: text,
        });
    };

    _onSearch = (text) => {
        LayoutAnimation.linear();
        this.setState({
            isSearching: true,
            searchText: text,
        });
    };

    _selectItem = (item) => {
        item.update(this.isCascade);
        this._updateSelectedItems();
    };

    _getUpdateSelectedItems = (treeItem) => {
        let selectedItems =  treeItem.getChildren().reduce((prv, cur) => {
            return [...prv, ...cur.getFullSelectChildren(this.isCascade)];
        }, []);
        const selectedIncludeWeakItems = treeItem.getChildren().reduce((prv, cur) => {
            return [...prv, ...cur.getFullSelectChildren(this.isCascade, { includeWeakNode: true })];
        }, []);
        //加上无任何挂载的虚拟节点
        if (selectedItems.length !== selectedIncludeWeakItems.length) {
            const sa = new Set(selectedItems);
            const minus = selectedIncludeWeakItems.filter(fil => {
                !sa.has(fil) && treeItem.getChildren().reduce((prv, cur) => {
                    return prv || fil.hasAncestor(cur);
                }, false);
            });
            selectedItems = [...selectedItems, ...minus];
        }

        return selectedItems;
    }

    _updateSelectedItems = () => {
        const {levelItems, addedLevelItems} = this.state;
        let tmpSelectedItems = this._getUpdateSelectedItems(levelItems[0]);
        if (addedLevelItems && Array.isArray(addedLevelItems) && addedLevelItems.length > 0) {
            addedLevelItems.forEach(itemTree => {
                tmpSelectedItems = tmpSelectedItems.concat(this._getUpdateSelectedItems(itemTree));
            });
        }

        // 查重
        tmpSelectedItems = Array.from(new Set(tmpSelectedItems));

        const stateData = new Set(this.state.selectedItems);
        const endData = [];
        tmpSelectedItems = tmpSelectedItems.filter((item) => {
            if (stateData.has(item)) {
                return true;
            } else {
                endData.push(item);
                return false;
            }
        })

        this.setState({ selectedItems: [...tmpSelectedItems, ...endData] });
    }

    _setSelectedItems = (idKey) => {
        try {
            const {levelItems, addedLevelItems} = this.state;
            let tmpSelectedItems = levelItems[0].setInitialState(idKey, this.isCascade);
            if (addedLevelItems && Array.isArray(addedLevelItems) && addedLevelItems.length > 0) {
                addedLevelItems.forEach(addedTree => {
                    tmpSelectedItems = tmpSelectedItems.concat(addedTree.setInitialState(idKey, this.isCascade));
                });
            } 
            tmpSelectedItems && tmpSelectedItems.forEach(item => item.isSelected = 1);
            this.setState({selectedItems: tmpSelectedItems});
        } catch (e) {

        }
    }
}

const styles = StyleSheet.create({
    multiIcon: {
        width: 18,
        height: 18,
        borderRadius: 9
    },
    icon: {
        marginLeft: 4,
        width: 19,
        height: 22,
    },
    view: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#eff1f1',
    },
    leftButtons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    innersafeview: {
        flex: 1,
        backgroundColor: '#F7F7F9',
    },
    searchbarContainer: {
        flex: 0,
        backgroundColor: '#F7F7F9',
    },
    listview: {
        backgroundColor: 'transparent',
    },
    searchingViewContainer: {
        flex: 1,
        backgroundColor: '#eff1f1',
    },
    displayView: {
        flex: 1,
        flexDirection: 'row',
    },
    emptyImage: {
        marginTop: 100,
        alignSelf: 'center',
    },
});
