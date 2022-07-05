const path = require('path');

module.exports = {
  entry: path.resolve(__dirname, 'src/index.ts'),
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  mode: 'production', // use 'development' for debugging purposes.
  output: {
    filename: 'appconfiguration.js',
    library: {
      name: 'AppConfiguration',
      type: 'umd',
      export: 'default',
    },
    path: path.resolve(__dirname, 'dist'),
  },
};
