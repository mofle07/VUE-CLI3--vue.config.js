require('events').EventEmitter.defaultMaxListeners = 0 // 处理爆栈警告

// webpack三个基础
const fs = require('fs')
const path = require('path')
const webpack = require('webpack')

// This plugin uses terser to minify your JavaScript 压缩js代码
const TerserPlugin = require('terser-webpack-plugin')

// 抽离第三方依赖, 不用每次构建时都打包, 加快速度
const AutoDllPlugin = require('autodll-webpack-plugin')

// 生产环境打包分析工具
const {
  BundleAnalyzerPlugin
} = require('webpack-bundle-analyzer')

// 显示打包进度条
const SimpleProgressWebpackPlugin = require('simple-progress-webpack-plugin')

// 以下三个让webpack能同时处理多个文件
const os = require('os')
const HappyPack = require('happypack')
const happyThreadPool = HappyPack.ThreadPool({
  size: os.cpus().length
})

// 本地cdn文件
const cdn = require('./config/local')

// 本地cdn文件
const proxy = require('./config/proxy')

// 重置指定文件路径快捷方式方法, 在打包时替换成完整路径
const resolve = dir => {
  return path.join(__dirname, dir)
}

// 根据不同环境, 应用不同构建代码
const env = process.env.NODE_ENV || 'development'
const IS_PROD = env === 'production'

// 根据环境, 配置根路径
const BASE_URL = IS_PROD ? '/tontisa-xq-ui/' : '/'

module.exports = {
  publicPath: BASE_URL,
  chainWebpack: config => {
    // key,value自行定义，比如.set('@@', resolve('src/components')),
    // 需要设置多个快捷方式时, 可以链式继续写
    config.resolve.alias.set('@', resolve('src'))

    // 打包时, 根据不同环境, 在index.html页面引入不同cdn
    config.plugin('html').tap(args => {
      if (process.env.NODE_ENV === 'production') {
        args[0].cdn = cdn.build
      }
      if (process.env.NODE_ENV === 'development') {
        args[0].cdn = cdn.dev
      }
      return args
    })
  },
  configureWebpack: config => {
        if (IS_PROD) {
            // 生产环境配置
            // 不需要打包的文件(cdn引入的)
            config.externals = {
                'vue': 'Vue',
                'vue-router': 'VueRouter',
                'axios': 'axios',
                'lodash': '_',
                'mathjs': 'math',
                'moment': 'moment',
            }
            config.plugins.push(
                // 生产环境剔除 debuger和console
                new TerserPlugin({
                    cache: true,
                    parallel: true,
                    sourceMap: false, // Must be set to true if using source-maps in production
                    terserOptions: {
                        compress: {
                            drop_console: false,
                            drop_debugger: true
                        }
                    },
                    chunkFilter: (chunk) => {
                        // Exclude uglification for the `vendor` chunk
                        if (chunk.name && chunk.name.match(/vendor/g)) {
                            return false
                        }
                        return true
                    }
                }),
                // 线上环境查看打包情况
                new BundleAnalyzerPlugin({
                    openAnalyzer: false,
                    analyzerMode: 'static'
                })
            )
        } else {
            config.plugins.push(
                new AutoDllPlugin({
                    inject: true, // 自动将打包的文件引入大index.html
                    debug: !IS_PROD,
                    filename: 'chunk-[name]s.[hash:8].js',
                    path: './js',
                    entry: {
                      vendor: [
                        // 自定义不需要重复构建的文件
                        'vue',
                        'vue-router',
                        'axios',
                        'lodash',
                        'moment',
                        'echarts'
                      ]
                    }
                }),
                new HappyPack({
                    id: 'happy-babel-js',
                    loaders: ['babel-loader?cacheDirectory=true'],
                    threadPool: happyThreadPool
                })
            )
        }
        // 自动打包vendor dll库 显示打包进度条
        config.plugins.push(
            new SimpleProgressWebpackPlugin({ 
                format: 'minimal'
            }),
            new webpack.DefinePlugin({
                // 配置不同环境的url前置
                sysHost: '"/xxxxxx/"'
            })
        )
    },
    // 构建时开启多进程处理 babel 编译
    parallel: require('os').cpus().length > 1,

    // 服务配置
    devServer: {
        // open: IS_PROD,  // 配置自动启动浏览器
        compress: true,
        port: 8081, // 端口号
        host: '0.0.0.0',
        hot: false, // 热模块更新作用
        inline: false, // 关闭热更新
        https: false, // https:{type:Boolean}
        proxy: proxy() // 配置多个代理
    }
}
