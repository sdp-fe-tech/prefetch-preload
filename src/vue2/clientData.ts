
function normalizePath(path: string): string {
  return path.replace(/^@\/|^\.\.\//, '');
}

type getFn = (url: string, params: Params) => Promise<any>;

type postFn = (url: string, params: Params, headerParams?: HeaderParams) => Promise<any>;


interface Ctx {
  get: getFn,
  post: postFn
}

interface Params {
  [key: string]: any;
  file?: File;
}

interface HeaderParams {
  [key: string]: any;
}

interface DataLoader {
  name: string;
  fn: (ctx: Ctx) => Promise<any> | Promise<any>;
}

interface RouteMap {
  path: string;
  component: string;
}

// 预取数据状态管理模块
class PrefetchDataManager {
  private dataMap: Map<string, DataLoader[]>; // 使用Map来管理预取数据，避免命名冲突
  public currentPath: string | null;
  public ctx: Ctx | undefined;

  constructor() {
    this.dataMap = new Map();
    this.currentPath = null;
  }

  set(routePath: string, dataLoader: DataLoader[]): void {
    this.currentPath = routePath;
    // 将数据获取逻辑保存到管理器中
    this.dataMap.set(routePath, dataLoader);
  }

  setCurrentPath(routePath: string): void {
    this.currentPath = routePath;
  }

  get(name: string): Promise<any> | null {
    const dataLoader = this.dataMap.get(this.currentPath!);
    if (dataLoader) {
      const loader = dataLoader.find((v) => v.name === name);
      if (loader) {
        return loader.fn as any;
      }
    }
    return Promise.resolve(null);
  }

  getPagePrefetchFns(routePath: string): DataLoader[] | null {
    // 获取指定路径的预取数据
    if (routePath) {
      let pageId: string | null = null;
      console.log('_base_route_maps', window._base_route_maps);
      const routeMap: RouteMap | undefined = window._base_route_maps?.find(
        (v: RouteMap) => v.path === routePath,
      );
      if (routeMap) {
        pageId = normalizePath(routeMap.component);
      }
      if (pageId) {
        return window._prefetchAsyncFns
          ? window._prefetchAsyncFns[pageId + '.vue']
          : null;
      }
    }
    return null;
  }

  delete(routePath: string): void {
    // 清除指定路径的预取数据
    this.dataMap.delete(routePath);
  }
}

// 创建单例模式的管理器
const prefetchDataManager = new PrefetchDataManager();

export async function getClientData(fn: string): Promise<void> {
  console.log(`Prefetch define: ${fn}`);
}

export async function useClientData(name: string): Promise<any> {
  if (!prefetchDataManager || !prefetchDataManager.currentPath) {
    return Promise.resolve(null);
  }
  try {
    const dataPromise = prefetchDataManager.get(name);
    if (dataPromise) {
      return dataPromise;
    }
    return Promise.resolve(null);
  } catch (error) {
    console.error(`${name} 获取数据时发生错误:`, error);
    return Promise.reject(error);
  }
}

export async function handleRouteBeforeEnter(
  to: { path: string },
  from: { path: string },
  next: () => void,
  ctx: { get: getFn, post: postFn },
): Promise<void> {
  prefetchDataManager.ctx = ctx;
  let currentRoutePath = to.path;
  prefetchDataManager.setCurrentPath(currentRoutePath);
  try {
    if (to.path) {
      const fnObjs = prefetchDataManager.getPagePrefetchFns(currentRoutePath);
      if (fnObjs) {
        // 执行这个path下的所有函数
        // 返回一个带有方法签名的 promise 对象数组
        const fns = fnObjs.map((fnObj) => {
          return {
            name: fnObj.name,
            fn: fnObj.fn(ctx),
          };
        });
        prefetchDataManager.set(currentRoutePath, fns as any);
        next();
      }
      next();
    }
  } catch (error) {
    console.error('Error during prefetching:', error);
    next();
  }
  next();
}

// 声明全局变量的类型
declare global {
  interface Window {
    _base_route_maps: RouteMap[];
    _prefetchAsyncFns: { [key: string]: DataLoader[] };
  }
}
