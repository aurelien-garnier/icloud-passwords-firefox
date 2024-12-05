const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = {
  mode: "development",
  entry: {
    background: "./src/background/index.ts",
    fill_password: "./src/background/fill-password.ts",
    fill_one_time_code: "./src/background/fill-one-time-code.ts",
    content_script: "./src/background/content-script.ts",
    settings: "./src/ui/settings/index.tsx",
    popup: "./src/ui/popup/index.tsx",
    in_page: "./src/ui/in-page/index.tsx",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".jsx", ".js"],
    fallback: {
      crypto: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.s[ac]ss$/,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "./meta",
        },
        {
          from: "./LICENSE",
        },
      ],
    }),
    new HtmlWebpackPlugin({
      template: "./src/ui/index.html",
      filename: "./settings.html",
      inject: "body",
      chunks: ["settings"],
    }),
    new HtmlWebpackPlugin({
      template: "./src/ui/index.html",
      filename: "./popup.html",
      inject: "body",
      chunks: ["popup"],
    }),
    new HtmlWebpackPlugin({
      template: "./src/ui/index.html",
      filename: "./in_page.html",
      inject: "body",
      chunks: ["in_page"],
    }),
  ],
  devtool: "source-map",
};
