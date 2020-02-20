const webpack = require('webpack');
const path = require('path');


const APP_DIR = path.resolve(__dirname, 'src/');
const BUILD_DIR = path.resolve(__dirname, 'docs/dist/');

const config = {
	mode: 'development',
	entry: APP_DIR + '/index.jsx',

	output: {
		path: BUILD_DIR,
		filename: 'bundle.js'
	},
	module: {
		rules: [
			// Pass all js files through babel (with react as well)
			{
				test: /\.m?jsx?$/,
				exclude: /node_modules/,
				use: {
					loader: 'babel-loader',
					options: {
						presets: ['@babel/preset-env', '@babel/preset-react']
					}
				}
			}
		]
	}
};

module.exports = config;