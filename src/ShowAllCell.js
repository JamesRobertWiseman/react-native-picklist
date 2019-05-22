import React from 'react';
import { TouchableOpacity, StyleSheet, View, Image, Text, DeviceEventEmitter } from 'react-native';
import PropTypes from 'prop-types';
import { select_image, notselect_image } from './DefaultRow';
import Types from './Types';
import {isCascade} from './Util'

export default class extends React.PureComponent {
    static propTypes = {
        ...Types,
        treeNode: PropTypes.object.isRequired,
        onPress: PropTypes.func.isRequired
    };

    constructor(props) {
        super(props);
        this.tree = props.treeNode;
        this.cascade = isCascade(props);
        this.state = {
            status: this.tree.selectStatus(this.cascade),
        };
    }

    componentDidMount() {
        this.listener = DeviceEventEmitter.addListener(
            '__treenode__status__update__' + this.tree.getStringId(),
            this._refresh
        );
    }

    componentWillUnmount() {
        this.listener.remove();
    }

    render() {
        const {labels: {selectAll, deselectAll}} = this.props;
        const isFull = this.tree.isFullSelect(this.cascade);
        const image = isFull ? select_image() : notselect_image();
        const text = isFull ? deselectAll : selectAll;
        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => this.props.onPress(this.tree)}
            >
                <View style={styles.view}>
                    <Image source={image} style={styles.image} />
                    <Text style={styles.text}>
                        {text}
                    </Text>
                </View>
            </TouchableOpacity>
        );
    }

    _refresh = () => {
        this.setState({
            status: this.tree.selectStatus(this.cascade),
        });
    };
}

const styles = StyleSheet.create({
    view: {
        backgroundColor: 'white',
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: 15,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e6e6ea',
    },
    image: {
        width: 18,
        height: 18,
        borderRadius: 9,
        marginRight: 10,
        marginLeft: 25,
        marginTop: 10,
        marginBottom: 10,
    },
    text: {
        flex: 1,
        marginVertical: 20,
        fontSize: 16,
        color: '#333333',
    },
});