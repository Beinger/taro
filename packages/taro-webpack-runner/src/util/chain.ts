import CssoWebpackPlugin from 'csso-webpack-plugin';
import * as htmlWebpackIncludeAssetsPlugin from 'html-webpack-include-assets-plugin';
import * as HtmlWebpackPlugin from 'html-webpack-plugin';
import { mergeWith, partial } from 'lodash';
import { fromPairs, map, mapKeys, pipe, toPairs } from 'lodash/fp';
import * as MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as path from 'path';
import * as UglifyJsPlugin from 'uglifyjs-webpack-plugin';
import * as webpack from 'webpack';

import { appPath } from '.';
import { getPostcssPlugins } from '../config/postcss.conf';
import { Option, PostcssOption } from './types';

const mergeFunc = (objValue, srcValue) => {
  if (Array.isArray(objValue) && Array.isArray(srcValue)) {
    return objValue.concat(srcValue)
  }
}

const customizedMerge = (obj, ...args) => {
  return mergeWith(obj, ...args, mergeFunc)
}

const defaultUglifyJsOption = {
  keep_fnames: true,
  output: {
    comments: false,
    keep_quoted_props: true,
    quote_keys: true,
    beautify: false
  },
  warnings: false
}

const defaultCSSCompressOption = {
  mergeRules: false,
  mergeIdents: false,
  reduceIdents: false,
  discardUnused: false,
  minifySelectors: false
}

const defaultBabelLoaderOption = {
  plugins: [
    require.resolve('babel-plugin-syntax-dynamic-import'),
    [
      require.resolve('babel-plugin-transform-react-jsx'),
      {
        pragma: 'Nerv.createElement'
      }
    ]
  ]
}

const defaultMediaUrlLoaderOption = {}
const defaultFontUrlLoaderOption = {
  limit: 2000
}
const defaultImageUrlLoaderOption = {
  limit: 2000
}
// type ConditionResult = string | false
// type ValidCondition = string | RegExp | ((filename: ConditionResult) => ConditionResult)
// type Conditions = ValidCondition | ValidCondition[]
// const condition = (type: 'filterIn' | 'filterOut', item: Conditions, filename: ConditionResult): ConditionResult => {
//   if (filename === false) return filename

//   let isMatched

//   if (item instanceof RegExp) {
//     isMatched = item.test(filename)
//   } else if (item instanceof Function) {
//     isMatched = item(filename)
//   } else if (typeof item === 'string') {
//     isMatched = filename.indexOf(item) > -1
//   } else if (Array.isArray(item) && item.length > 0) {
//     return pipe(item.map(v => {
//       return partial(condition, type, v)
//     }))(filename)
//   }

//   if (isMatched) {
//     return type === 'filterIn' ? filename : false
//   } else {
//     return type === 'filterOut' ? false : filename
//   }
// }

const getLoader = (loaderName: string, options: Option) => {
  return {
    loader: require.resolve(loaderName),
    options: options || {}
  }
}

const getPlugin = (plugin: any, args: Option) => {
  return {
    plugin,
    args: [args]
  }
}

const mergeOption = ([...options]: Option[]): Option => {
  return customizedMerge({}, ...options)
}

const getDllContext = (outputRoot, dllDirectory) => {
  return path.join(appPath, outputRoot, dllDirectory)
}
const getNamedDllContext = (outputRoot, dllDirectory, name) => {
  return {
    context: path.join(appPath, outputRoot, dllDirectory),
    name
  }
}

const processDllOption = context => {
  return {
    path: path.join(context, '[name]-manifest.json'),
    name: '[name]_library',
    context
  }
}

const processDllReferenceOption = ({ context, name }) => {
  return {
    context,
    manifest: path.join(context, `${name}-manifest.json`)
  }
}

const processEnvOption = partial(mapKeys, key => `process.env.${key}`)

const getStyleLoader = pipe(mergeOption, partial(getLoader, 'style-loader'))
const getCssLoader = pipe(mergeOption, partial(getLoader, 'css-loader'))
const getPostcssLoader = pipe(mergeOption, partial(getLoader, 'postcss-loader'))
const getResolveUrlLoader = pipe(mergeOption, partial(getLoader, 'resolve-url-loader'))
const getSassLoader = pipe(mergeOption, partial(getLoader, 'sass-loader'))
const getLessLoader = pipe(mergeOption, partial(getLoader, 'less-loader'))
const getStylusLoader = pipe(mergeOption, partial(getLoader, 'stylus-loader'))
const getBabelLoader = pipe(mergeOption, partial(getLoader, 'babel-loader'))
const getUrlLoader = pipe(mergeOption, partial(getLoader, 'url-loader'))
const getExtractCssLoader = () => {
  return {
    loader: MiniCssExtractPlugin.loader
  }
}

const getMiniCssExtractPlugin = pipe(mergeOption, partial(getPlugin, MiniCssExtractPlugin))
const getHtmlWebpackPlugin = pipe(mergeOption, partial(getPlugin, HtmlWebpackPlugin))
const getDefinePlugin = pipe(mergeOption, partial(getPlugin, webpack.DefinePlugin))
const getHotModuleReplacementPlugin = partial(getPlugin, webpack.HotModuleReplacementPlugin, {})
const getUglifyPlugin = ([enableSourceMap, uglifyOptions]) => {
  return new UglifyJsPlugin({
    cache: true,
    parallel: true,
    sourceMap: enableSourceMap,
    uglifyOptions: customizedMerge({}, defaultUglifyJsOption, uglifyOptions)
  })
}
const getCssoWebpackPlugin = ([cssoOption]) => {
  return pipe(mergeOption, partial(getPlugin, CssoWebpackPlugin))([defaultCSSCompressOption, cssoOption])
}
const getDllPlugin = pipe(getDllContext, processDllOption, partial(getPlugin, webpack.DllPlugin))
const getDllReferencePlugin = pipe(getNamedDllContext, processDllReferenceOption, partial(getPlugin, webpack.DllReferencePlugin))
const getHtmlWebpackIncludeAssetsPlugin = partial(getPlugin, htmlWebpackIncludeAssetsPlugin)

const getEntry = (customEntry = {}) => {
  return Object.assign(
    {
      app: path.join('.temp', 'app.js')
    },
    customEntry
  )
}

const getModule = ({
  staticDirectory,
  designWidth,
  deviceRatio,
  enableExtract,
  enableSourceMap,

  styleLoaderOption,
  cssLoaderOption,
  lessLoaderOption,
  sassLoaderOption,
  stylusLoaderOption,
  fontUrlLoaderOption,
  imageUrlLoaderOption,
  mediaUrlLoaderOption,
  esnextModules = [] as string[],

  module,
  plugins
}) => {
  const postcssOption: PostcssOption = module.postcss || {}

  const styleLoader = getStyleLoader([{ sourceMap: enableSourceMap }, styleLoaderOption])

  const extractCssLoader = getExtractCssLoader()

  const lastCssLoader = enableExtract ? extractCssLoader : styleLoader

  const cssOptions = [
    {
      importLoaders: 1,
      sourceMap: enableSourceMap,
      modules: postcssOption.cssModules && postcssOption.cssModules.enable
    },
    cssLoaderOption
  ]
  /**
   * css-loader 1.0.0版本移除了minimize选项...升级需谨慎
   * 
   * https://github.com/webpack-contrib/css-loader/releases/tag/v1.0.0
   */
  const cssLoader = getCssLoader(cssOptions)

  const postcssLoader = getPostcssLoader([
    { sourceMap: enableSourceMap },
    {
      ident: 'postcss',
      plugins: getPostcssPlugins({
        designWidth,
        deviceRatio,
        postcssOption
      })
    }
  ])

  const resolveUrlLoader = getResolveUrlLoader([])

  const sassLoader = getSassLoader([{ sourceMap: true }, sassLoaderOption])

  const lessLoader = getLessLoader([{ sourceMap: enableSourceMap }, lessLoaderOption])

  const stylusLoader = getStylusLoader([{ sourceMap: enableSourceMap }, stylusLoaderOption])

  const rule: Option = {}

  rule.jsx = {
    use: {
      babelLoader: {
        options: {
          ...plugins.babel,
          sourceMap: enableSourceMap
        }
      }
    }
  }

  rule.media = {
    use: {
      urlLoader: {
        options: {
          name: `${staticDirectory}/media/[name].[ext]`,
          ...mediaUrlLoaderOption
        }
      }
    }
  }
  rule.font = {
    use: {
      urlLoader: {
        options: {
          name: `${staticDirectory}/fonts/[name].[ext]`,
          ...fontUrlLoaderOption
        }
      }
    }
  }
  rule.image = {
    use: {
      urlLoader: {
        options: {
          name: `${staticDirectory}/images/[name].[ext]`,
          ...imageUrlLoaderOption
        }
      }
    }
  }
  rule.sass = {
    test: /\.(css|scss|sass)(\?.*)?$/,
    use: [lastCssLoader, cssLoader, postcssLoader, resolveUrlLoader, sassLoader]
  }
  rule.less = {
    test: /\.less(\?.*)?$/,
    use: [lastCssLoader, cssLoader, postcssLoader, lessLoader]
  }
  rule.styl = {
    test: /\.styl(\?.*)?$/,
    use: [lastCssLoader, cssLoader, postcssLoader, stylusLoader]
  }
  rule.sassInNodemodules = {
    test: /\.(css|scss|sass)(\?.*)?$/,
    use: [lastCssLoader, cssLoader, sassLoader]
  }
  rule.lessInNodemodules = {
    test: /\.less(\?.*)?$/,
    use: [lastCssLoader, cssLoader, lessLoader]
  }
  rule.stylInNodemodules = {
    test: /\.styl(\?.*)?$/,
    use: [lastCssLoader, cssLoader, stylusLoader]
  }

  const isNodemodule = filename => /\bnode_modules\b/.test(filename)
  if (Array.isArray(esnextModules) && esnextModules.length) {
    const esnextModulePaths = esnextModules.map(v => path.join(appPath, 'node_modules', v))
    /**
     * isEsnextModule
     * 
     * 使用字符串匹配判断是否是es模块
     */
    const isEsnextModule = filename => esnextModulePaths.some(v => filename.indexOf(v) === 0)
    const notTaroModules = filename => isEsnextModule(filename) ? false : isNodemodule(filename)

    /* 通过taro处理 */
    rule.jsx.exclude = [notTaroModules]
    rule.sass.exclude = [notTaroModules]
    rule.less.exclude = [notTaroModules]
    rule.styl.exclude = [notTaroModules]

    rule.sassInNodemodules.include = [notTaroModules]
    rule.lessInNodemodules.include = [notTaroModules]
    rule.stylInNodemodules.include = [notTaroModules]
  } else {
    rule.jsx.exclude = [isNodemodule]
    rule.sass.exclude = [isNodemodule]
    rule.less.exclude = [isNodemodule]
    rule.styl.exclude = [isNodemodule]
    rule.sassInNodemodules.include = [isNodemodule]
    rule.lessInNodemodules.include = [isNodemodule]
    rule.stylInNodemodules.include = [isNodemodule]
  }
  return { rule }
}

const getOutput = ([{ outputRoot, publicPath, chunkDirectory }, customOutput]) => {
  return Object.assign(
    {
      path: path.join(appPath, outputRoot),
      filename: 'js/[name].js',
      chunkFilename: `${chunkDirectory}/[name].js`,
      publicPath
    },
    customOutput
  )
}

const getDllOutput = ({ outputRoot, dllDirectory }) => {
  return {
    path: path.join(appPath, outputRoot, dllDirectory),
    filename: '[name].dll.js',
    library: '[name]_library'
  }
}

const getDevtool = enableSourceMap => {
  return enableSourceMap ? 'cheap-module-eval-source-map' : 'none'
}

const getDllReferencePlugins = ({ dllEntry, outputRoot, dllDirectory }) => {
  return pipe(
    toPairs,
    map(([key]) => {
      return [`dll${key}`, getDllReferencePlugin(outputRoot, dllDirectory, key)]
    }),
    fromPairs
  )(dllEntry)
}

export { getStyleLoader, getCssLoader, getPostcssLoader, getResolveUrlLoader, getSassLoader, getLessLoader, getStylusLoader, getExtractCssLoader, getEntry, getOutput, getMiniCssExtractPlugin, getHtmlWebpackPlugin, getDefinePlugin, processEnvOption, getHotModuleReplacementPlugin, getDllPlugin, getModule, getUglifyPlugin, getDevtool, getDllOutput, getDllReferencePlugins, getHtmlWebpackIncludeAssetsPlugin, getCssoWebpackPlugin, getBabelLoader, defaultBabelLoaderOption, getUrlLoader, defaultMediaUrlLoaderOption, defaultFontUrlLoaderOption, defaultImageUrlLoaderOption }
