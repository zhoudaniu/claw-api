/**
 * 热更新面板组件
 * 显示当前版本、最新版本、检查按钮
 */
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Check, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface VersionInfo {
  current: string;
  resourcesPath: string;
  isPackaged: boolean;
}

interface UpdateProgress {
  progress: number;
  status: string;
}

interface UpdateResult {
  success: boolean;
  version?: string;
  error?: string;
}

export function HotUpdatePanel() {
  const { t } = useTranslation('settings');
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [progress, setProgress] = useState<UpdateProgress | null>(null);
  const [lastResult, setLastResult] = useState<UpdateResult | null>(null);

  // 获取版本信息
  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const info = await window.electron.ipcRenderer.invoke('hotupdate:getVersion');
        setVersionInfo(info as VersionInfo);
      } catch (error) {
        console.error('获取版本信息失败:', error);
      }
    };

    fetchVersion();
  }, []);

  // 监听更新进度
  useEffect(() => {
    const offProgress = window.electron.ipcRenderer.on('hotupdate:progress', (_event, data) => {
      setProgress(data as UpdateProgress);
    });

    const offResult = window.electron.ipcRenderer.on('hotupdate:result', (_event, data) => {
      setLastResult(data as UpdateResult);
      setIsChecking(false);
      setProgress(null);
    });

    return () => {
      offProgress?.();
      offResult?.();
    };
  }, []);

  // 检查更新
  const handleCheckUpdate = useCallback(async () => {
    if (isChecking) return;

    setIsChecking(true);
    setProgress(null);
    setLastResult(null);

    try {
      const result = await window.electron.ipcRenderer.invoke('hotupdate:check');
      const updateResult = result as UpdateResult;

      if (!updateResult.updated && updateResult.reason) {
        toast.info(updateResult.reason);
      }
    } catch (error) {
      toast.error(`检查更新失败: ${error}`);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking]);

  // 开发模式提示
  if (versionInfo && !versionInfo.isPackaged) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            热更新
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            开发模式下热更新功能已禁用。打包后即可使用。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          热更新
        </CardTitle>
        <CardDescription>
          应用启动后自动检查更新，也可手动检查
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 版本信息 */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <span className="text-sm text-muted-foreground">当前版本</span>
          <span className="text-sm font-medium">
            v{versionInfo?.current || '加载中...'}
          </span>
        </div>

        {/* 进度显示 */}
        {progress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{progress.status}</span>
              <span className="font-medium">{progress.progress}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 上次检查结果 */}
        {lastResult && (
          <div
            className={cn(
              'p-3 rounded-lg text-sm',
              lastResult.success
                ? 'bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400'
                : 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400'
            )}
          >
            {lastResult.success
              ? `已更新到 v${lastResult.version}`
              : `更新失败: ${lastResult.error}`}
          </div>
        )}

        {/* 检查按钮 */}
        <Button
          onClick={handleCheckUpdate}
          disabled={isChecking}
          className="w-full"
          variant="outline"
        >
          {isChecking ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              检查中...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              检查更新
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
