import React, { useState } from 'react';
import {
  Key,
  Cpu,
  Sliders,
  Shield,
  Eye,
  EyeOff,
  Bell,
  Smartphone,
  Save,
  Check,
} from 'lucide-react';
import { AppHeader } from '../components/AppHeader';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface SettingsAppProps {
  onBack: () => void;
  showStatusBar: boolean;
  onToggleStatusBar: () => void;
  onLockScreen: () => void;
}

export const SettingsApp: React.FC<SettingsAppProps> = ({
  onBack,
  showStatusBar,
  onToggleStatusBar,
  onLockScreen,
}) => {
  const [apiKey, setApiKey] = useState('AIzaSyD-mock-pocket-key-9921');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [apiEndpoint, setApiEndpoint] = useState('https://generativelanguage.googleapis.com');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const availableModels = [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash (推荐)',
      desc: '超快响应速度，适合小手机即时对话与智能生成',
      speed: '极速 ~180ms',
    },
    {
      id: 'gemini-2.5-pro',
      name: 'Gemini 2.5 Pro (深度推理)',
      desc: '复杂角色心理演练与世界书长文本逻辑推理',
      speed: '高智商 ~650ms',
    },
    {
      id: 'gemini-custom',
      name: '自定义端点 / 本地大模型',
      desc: '支持兼容 OpenAI 格式或自定义本地 API 服务',
      speed: '自建节点',
    },
  ];

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="flex-1 w-full flex flex-col bg-[#F3F6F8] overflow-hidden">
      <AppHeader
        title="设置 · 系统与模型"
        subtitle="PocketOS 核心配置"
        onBack={onBack}
        rightAction={
          <button
            onClick={handleSave}
            className="flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-100/90 px-2.5 py-1 rounded-md active:scale-95 transition-transform"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>已保存</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>保存</span>
              </>
            )}
          </button>
        }
      />

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar p-4 space-y-3 pb-[max(env(safe-area-inset-bottom,0px),10px)]">
        {/* Section 1: API Configuration */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-[#2C4A5C]">
            <Key className="w-3.5 h-3.5 text-sky-600" />
            <span>API 密钥与服务配置</span>
          </div>

          <div className="glass-card rounded-2xl p-4 space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-[#2C4A5C] block mb-1">
                API 接入端点 (Base URL)
              </label>
              <input
                type="text"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                className="w-full bg-white/70 border border-white rounded-xl px-3 py-2 text-xs text-[#2C4A5C] outline-none font-mono"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#2C4A5C] block mb-1">
                API Key (密钥)
              </label>
              <div className="relative flex items-center">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full bg-white/70 border border-white rounded-xl pl-3 pr-10 py-2 text-xs text-[#2C4A5C] outline-none font-mono"
                  placeholder="请输入您的 API Key"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 text-slate-400 hover:text-slate-600"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                🔒 当前阶段处于 UI 框架演示，密钥仅在本地模拟存储
              </p>
            </div>
          </div>
        </div>

        {/* Section 2: Model Configuration */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-[#2C4A5C]">
            <Cpu className="w-3.5 h-3.5 text-sky-600" />
            <span>AI 模型选择</span>
          </div>

          <div className="glass-card rounded-2xl p-2 divide-y divide-slate-100/60 overflow-hidden">
            {availableModels.map((model) => {
              const isSelected = selectedModel === model.id;
              return (
                <div
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`p-3 rounded-xl cursor-pointer transition-colors flex items-start justify-between ${
                    isSelected ? 'bg-sky-50/70' : 'hover:bg-white/40'
                  }`}
                >
                  <div className="flex-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[#2C4A5C]">{model.name}</span>
                      <span className="text-[9px] bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono">
                        {model.speed}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                      {model.desc}
                    </p>
                  </div>
                  <div className="w-4 h-4 rounded-full border border-sky-400 mt-0.5 flex items-center justify-center">
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-sky-600" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: System Preferences */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-[#2C4A5C]">
            <Sliders className="w-3.5 h-3.5 text-sky-600" />
            <span>系统交互偏好</span>
          </div>

          <div className="glass-card rounded-2xl divide-y divide-slate-100/60 overflow-hidden">
            <div className="flex items-center justify-between p-3.5">
              <div>
                <p className="text-xs font-bold text-[#2C4A5C]">顶部状态栏显示</p>
                <span className="text-[10px] text-slate-400">时间、电量、灵动岛指示器</span>
              </div>
              <button
                onClick={onToggleStatusBar}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                  showStatusBar ? 'bg-sky-500' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    showStatusBar ? 'left-5.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-3.5">
              <div>
                <p className="text-xs font-bold text-[#2C4A5C]">立即锁定屏幕</p>
                <span className="text-[10px] text-slate-400">返回锁屏界面与密码输入</span>
              </div>
              <button
                onClick={onLockScreen}
                className="px-3 py-1 rounded-lg bg-white/80 border border-slate-200 text-xs font-bold text-[#2C4A5C] hover:bg-white active:scale-95"
              >
                锁定
              </button>
            </div>
          </div>
        </div>

        {/* Section 4: PWA Installation & Fullscreen Experience */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 px-1 text-xs font-bold text-[#2C4A5C]">
            <Smartphone className="w-3.5 h-3.5 text-sky-600" />
            <span>PWA 原生应用与全屏体验</span>
          </div>

          <div className="glass-card rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#2C4A5C]">安装到手机主屏幕</p>
                <span className="text-[10px] text-slate-500">免地址栏与工具栏，享受 100% 真机全屏</span>
              </div>
            </div>
            <div>
              <PWAInstallButton />
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed pt-1 border-t border-slate-100">
              💡 提示：在 iOS Safari 点击底部分享按钮选择『添加到主屏幕』；在 Android Chrome 点击右上角『安装应用』即可。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
