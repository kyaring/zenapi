import './styles.css';

type Channel = {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  weight: number;
  status: string;
  rate_limit: number;
  models_json?: string;
};

type Token = {
  id: string;
  name: string;
  key_prefix: string;
  quota_total: number | null;
  quota_used: number;
  status: string;
};

type UsageLog = {
  id: string;
  model: string;
  channel_id: string;
  channel_name?: string | null;
  token_id: string;
  token_name?: string | null;
  total_tokens: number;
  latency_ms: number;
  status: string;
  created_at: string;
};

type DashboardData = {
  summary: {
    total_requests: number;
    total_tokens: number;
    avg_latency: number;
    total_errors: number;
  };
  byDay: Array<{ day: string; requests: number; tokens: number }>;
  byModel: Array<{ model: string; requests: number; tokens: number }>;
  byChannel: Array<{ channel_name: string; requests: number; tokens: number }>;
  byToken: Array<{ token_name: string; requests: number; tokens: number }>;
};

type Settings = {
  log_retention_days: number;
};

const root = document.querySelector<HTMLDivElement>('#app');
const apiBase = import.meta.env.VITE_API_BASE ?? '';
const tabs = [
  { id: 'dashboard', label: '数据面板' },
  { id: 'channels', label: '渠道管理' },
  { id: 'models', label: '模型广场' },
  { id: 'tokens', label: '令牌管理' },
  { id: 'usage', label: '使用日志' },
  { id: 'settings', label: '系统设置' }
];

const state = {
  token: localStorage.getItem('admin_token'),
  activeTab: 'dashboard',
  loading: false,
  notice: '',
  data: {
    channels: [] as Channel[],
    tokens: [] as Token[],
    models: [] as Array<{ id: string; channels: Array<{ id: string; name: string }> }>,
    usage: [] as UsageLog[],
    dashboard: null as DashboardData | null,
    settings: null as Settings | null
  }
};

if (!root) {
  throw new Error('Missing #app root');
}

function setNotice(message: string) {
  state.notice = message;
  render();
}

function setToken(token: string | null) {
  state.token = token;
  if (token) {
    localStorage.setItem('admin_token', token);
  } else {
    localStorage.removeItem('admin_token');
  }
  render();
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');
  if (state.token) {
    headers.set('Authorization', `Bearer ${state.token}`);
  }
  const response = await fetch(`${apiBase}${path}`, { ...options, headers });
  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
    }
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function loadDashboard() {
  state.data.dashboard = await apiFetch<DashboardData>('/api/dashboard');
}

async function loadChannels() {
  const result = await apiFetch<{ channels: Channel[] }>('/api/channels');
  state.data.channels = result.channels;
}

async function loadModels() {
  const result = await apiFetch<{ models: Array<{ id: string; channels: Array<{ id: string; name: string }> }> }>('/api/models');
  state.data.models = result.models;
}

async function loadTokens() {
  const result = await apiFetch<{ tokens: Token[] }>('/api/tokens');
  state.data.tokens = result.tokens;
}

async function loadUsage() {
  const result = await apiFetch<{ logs: UsageLog[] }>('/api/usage?limit=50');
  state.data.usage = result.logs;
}

async function loadSettings() {
  state.data.settings = await apiFetch<Settings>('/api/settings');
}

async function loadTab(tabId: string) {
  state.loading = true;
  state.notice = '';
  render();
  try {
    if (tabId === 'dashboard') {
      await loadDashboard();
    }
    if (tabId === 'channels') {
      await loadChannels();
    }
    if (tabId === 'models') {
      await loadModels();
    }
    if (tabId === 'tokens') {
      await loadTokens();
    }
    if (tabId === 'usage') {
      await loadUsage();
    }
    if (tabId === 'settings') {
      await loadSettings();
    }
  } catch (error) {
    setNotice((error as Error).message);
  } finally {
    state.loading = false;
    render();
  }
}

function renderLogin() {
  return `
    <div class="login-card">
      <h1>api-workers</h1>
      <p>请输入管理员密码登录管理台。</p>
      <form id="login-form" class="form-grid">
        <div>
          <label for="password">管理员密码</label>
          <input id="password" name="password" type="password" required />
        </div>
        <button class="button" type="submit">登录</button>
      </form>
      ${state.notice ? `<div class="notice">${state.notice}</div>` : ''}
    </div>
  `;
}

function renderSidebar() {
  return `
    <aside class="sidebar">
      <div class="brand">
        <h2>api-workers</h2>
        <span>console</span>
      </div>
      <nav class="nav-list">
        ${tabs
      .map(
        (tab) => `
          <button class="nav-item ${state.activeTab === tab.id ? 'active' : ''}" data-tab="${tab.id}" type="button">
            ${tab.label}
          </button>
        `
      )
      .join('')}
      </nav>
    </aside>
  `;
}

function renderDashboard() {
  const data = state.data.dashboard;
  if (!data) {
    return '<div class="card">暂无数据</div>';
  }
  const errorRate = data.summary.total_requests
    ? Math.round((data.summary.total_errors / data.summary.total_requests) * 100)
    : 0;
  return `
    <div class="grid three">
      <div class="card kpi">
        <span class="badge">总请求</span>
        <div class="value">${data.summary.total_requests}</div>
        <span class="mono">最近窗口</span>
      </div>
      <div class="card kpi">
        <span class="badge">总 Tokens</span>
        <div class="value">${data.summary.total_tokens}</div>
        <span class="mono">累计消耗</span>
      </div>
      <div class="card kpi">
        <span class="badge">错误率</span>
        <div class="value">${errorRate}%</div>
        <span class="mono">平均延迟 ${Math.round(data.summary.avg_latency)}ms</span>
      </div>
    </div>
    <div class="grid two" style="margin-top: 20px;">
      <div class="card">
        <div class="section-header">
          <h3>按日趋势</h3>
        </div>
        <table class="table">
          <thead><tr><th>日期</th><th>请求</th><th>Tokens</th></tr></thead>
          <tbody>
            ${data.byDay
      .map((row) => `<tr><td>${row.day}</td><td>${row.requests}</td><td>${row.tokens}</td></tr>`)
      .join('')}
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="section-header">
          <h3>模型排行</h3>
        </div>
        <table class="table">
          <thead><tr><th>模型</th><th>请求</th><th>Tokens</th></tr></thead>
          <tbody>
            ${data.byModel
      .map((row) => `<tr><td>${row.model ?? '-'}</td><td>${row.requests}</td><td>${row.tokens}</td></tr>`)
      .join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="grid two" style="margin-top: 20px;">
      <div class="card">
        <div class="section-header">
          <h3>渠道贡献</h3>
        </div>
        <table class="table">
          <thead><tr><th>渠道</th><th>请求</th><th>Tokens</th></tr></thead>
          <tbody>
            ${data.byChannel
      .map((row) => `<tr><td>${row.channel_name ?? '-'}</td><td>${row.requests}</td><td>${row.tokens}</td></tr>`)
      .join('')}
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="section-header">
          <h3>令牌贡献</h3>
        </div>
        <table class="table">
          <thead><tr><th>令牌</th><th>请求</th><th>Tokens</th></tr></thead>
          <tbody>
            ${data.byToken
      .map((row) => `<tr><td>${row.token_name ?? '-'}</td><td>${row.requests}</td><td>${row.tokens}</td></tr>`)
      .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderChannels() {
  return `
    <div class="grid two">
      <div class="card">
        <div class="section-header">
          <h3>新增渠道</h3>
        </div>
        <form id="channel-form" class="form-grid">
          <div>
            <label for="channel-id">渠道 ID（可选）</label>
            <input id="channel-id" name="id" placeholder="例如 ch_openai" />
          </div>
          <div>
            <label for="channel-name">名称</label>
            <input id="channel-name" name="name" required />
          </div>
          <div>
            <label for="channel-base">Base URL</label>
            <input id="channel-base" name="base_url" placeholder="https://api.openai.com" required />
          </div>
          <div>
            <label for="channel-key">API Key</label>
            <input id="channel-key" name="api_key" required />
          </div>
          <div class="form-grid two">
            <div>
              <label for="channel-weight">权重</label>
              <input id="channel-weight" name="weight" type="number" min="1" value="1" />
            </div>
            <div>
              <label for="channel-rate">限流</label>
              <input id="channel-rate" name="rate_limit" type="number" min="0" value="0" />
            </div>
          </div>
          <button class="button" type="submit">创建渠道</button>
        </form>
      </div>
      <div class="card">
        <div class="section-header">
          <h3>渠道列表</h3>
        </div>
        <table class="table">
          <thead>
            <tr><th>ID</th><th>名称</th><th>状态</th><th>权重</th><th>操作</th></tr>
          </thead>
          <tbody>
            ${state.data.channels
      .map(
        (channel) => `
              <tr>
                <td class="mono">${channel.id}</td>
                <td>${channel.name}</td>
                <td>${channel.status}</td>
                <td>${channel.weight}</td>
                <td>
                  <button class="button secondary" type="button" data-action="channel-test" data-id="${channel.id}">连通测试</button>
                  <button class="button ghost" type="button" data-action="channel-toggle" data-id="${channel.id}" data-status="${channel.status}">切换状态</button>
                  <button class="button ghost" type="button" data-action="channel-delete" data-id="${channel.id}">删除</button>
                </td>
              </tr>
            `
      )
      .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderModels() {
  return `
    <div class="card">
      <div class="section-header">
        <h3>模型广场</h3>
        <span class="badge">${state.data.models.length} 个模型</span>
      </div>
      <table class="table">
        <thead><tr><th>模型</th><th>渠道</th></tr></thead>
        <tbody>
          ${state.data.models
      .map(
        (model) => `
            <tr>
              <td>${model.id}</td>
              <td>${model.channels.map((channel) => channel.name).join(' / ')}</td>
            </tr>
          `
      )
      .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderTokens() {
  return `
    <div class="grid two">
      <div class="card">
        <div class="section-header">
          <h3>生成令牌</h3>
        </div>
        <form id="token-form" class="form-grid">
          <div>
            <label for="token-name">名称</label>
            <input id="token-name" name="name" required />
          </div>
          <div>
            <label for="token-quota">额度（可选）</label>
            <input id="token-quota" name="quota_total" type="number" min="0" placeholder="留空表示无限" />
          </div>
          <button class="button" type="submit">生成令牌</button>
        </form>
      </div>
      <div class="card">
        <div class="section-header">
          <h3>令牌列表</h3>
        </div>
        <table class="table">
          <thead>
            <tr><th>名称</th><th>状态</th><th>已用/额度</th><th>操作</th></tr>
          </thead>
          <tbody>
            ${state.data.tokens
      .map(
        (token) => `
              <tr>
                <td>${token.name}</td>
                <td>${token.status}</td>
                <td>${token.quota_used} / ${token.quota_total ?? '∞'}</td>
                <td>
                  <button class="button secondary" type="button" data-action="token-reveal" data-id="${token.id}">查看</button>
                  <button class="button secondary" type="button" data-action="token-toggle" data-id="${token.id}" data-status="${token.status}">切换</button>
                  <button class="button ghost" type="button" data-action="token-delete" data-id="${token.id}">删除</button>
                </td>
              </tr>
            `
      )
      .join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderUsage() {
  return `
    <div class="card">
      <div class="section-header">
        <h3>使用日志</h3>
        <button class="button secondary" type="button" data-action="usage-refresh">刷新</button>
      </div>
      <table class="table">
        <thead><tr><th>时间</th><th>模型</th><th>渠道</th><th>Tokens</th><th>延迟</th><th>状态</th></tr></thead>
        <tbody>
          ${state.data.usage
      .map(
        (log) => `
            <tr>
              <td>${log.created_at?.slice(0, 19).replace('T', ' ')}</td>
              <td>${log.model ?? '-'}</td>
              <td>${log.channel_name ?? log.channel_id ?? '-'}</td>
              <td>${log.total_tokens ?? 0}</td>
              <td>${log.latency_ms ?? 0} ms</td>
              <td>${log.status}</td>
            </tr>
          `
      )
      .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSettings() {
  const retention = state.data.settings?.log_retention_days ?? 30;
  return `
    <div class="card">
      <div class="section-header">
        <h3>系统设置</h3>
      </div>
      <form id="settings-form" class="form-grid two">
        <div>
          <label for="retention">日志保留天数</label>
          <input id="retention" name="log_retention_days" type="number" min="1" value="${retention}" />
        </div>
        <div style="display: flex; align-items: flex-end;">
          <button class="button" type="submit">保存设置</button>
        </div>
      </form>
    </div>
  `;
}

function renderContent() {
  if (state.loading) {
    return '<div class="card">加载中...</div>';
  }
  if (state.activeTab === 'dashboard') {
    return renderDashboard();
  }
  if (state.activeTab === 'channels') {
    return renderChannels();
  }
  if (state.activeTab === 'models') {
    return renderModels();
  }
  if (state.activeTab === 'tokens') {
    return renderTokens();
  }
  if (state.activeTab === 'usage') {
    return renderUsage();
  }
  if (state.activeTab === 'settings') {
    return renderSettings();
  }
  return '<div class="card">未知模块</div>';
}

function renderApp() {
  return `
    <div class="app-shell">
      ${renderSidebar()}
      <main class="main">
        <div class="top-bar">
          <div>
            <h1>${tabs.find((tab) => tab.id === state.activeTab)?.label ?? '管理台'}</h1>
            <p>集中管理渠道、模型、令牌与使用情况。</p>
          </div>
          <div class="top-bar-actions">
            <span class="badge">${state.token ? '已登录' : '未登录'}</span>
            <button class="button ghost" type="button" data-action="logout">退出</button>
          </div>
        </div>
        ${state.notice ? `<div class="notice">${state.notice}</div>` : ''}
        ${renderContent()}
      </main>
    </div>
  `;
}

function render() {
  root!.innerHTML = state.token ? renderApp() : renderLogin();
  bindEvents();
}

function bindEvents() {
  const loginForm = document.querySelector<HTMLFormElement>('#login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(loginForm);
      const password = String(formData.get('password') ?? '');
      try {
        const result = await apiFetch<{ token: string }>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ password })
        });
        setToken(result.token);
        state.notice = '';
        await loadTab(state.activeTab);
      } catch (error) {
        setNotice((error as Error).message);
      }
    });
  }

  const channelForm = document.querySelector<HTMLFormElement>('#channel-form');
  if (channelForm) {
    channelForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(channelForm);
      const payload = Object.fromEntries(formData.entries());
      const channelId = String(payload.id ?? '').trim();
      try {
        const body = {
          ...payload,
          weight: Number(payload.weight ?? 1),
          rate_limit: Number(payload.rate_limit ?? 0)
        } as Record<string, unknown>;
        if (channelId) {
          body.id = channelId;
        } else {
          delete body.id;
        }
        await apiFetch('/api/channels', {
          method: 'POST',
          body: JSON.stringify(body)
        });
        channelForm.reset();
        await loadChannels();
        render();
      } catch (error) {
        setNotice((error as Error).message);
      }
    });
  }

  const tokenForm = document.querySelector<HTMLFormElement>('#token-form');
  if (tokenForm) {
    tokenForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(tokenForm);
      const payload = Object.fromEntries(formData.entries());
      try {
        const result = await apiFetch<{ token: string }>('/api/tokens', {
          method: 'POST',
          body: JSON.stringify({
            name: payload.name,
            quota_total: payload.quota_total ? Number(payload.quota_total) : null
          })
        });
        setNotice(`新令牌: ${result.token}`);
        tokenForm.reset();
        await loadTokens();
        render();
      } catch (error) {
        setNotice((error as Error).message);
      }
    });
  }

  const settingsForm = document.querySelector<HTMLFormElement>('#settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const formData = new FormData(settingsForm);
      const value = Number(formData.get('log_retention_days'));
      try {
        await apiFetch('/api/settings', {
          method: 'PUT',
          body: JSON.stringify({ log_retention_days: value })
        });
        await loadSettings();
        setNotice('设置已更新');
      } catch (error) {
        setNotice((error as Error).message);
      }
    });
  }

  root!.querySelectorAll('[data-tab]').forEach((item) => {
    item.addEventListener('click', () => {
      const tab = (item as HTMLElement).dataset.tab ?? 'dashboard';
      state.activeTab = tab;
      loadTab(tab);
    });
  });

  root!.querySelectorAll('[data-action]').forEach((item) => {
    item.addEventListener('click', async () => {
      const action = (item as HTMLElement).dataset.action ?? '';
      const id = (item as HTMLElement).dataset.id ?? '';
      try {
        if (action === 'logout') {
          await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
          setToken(null);
          return;
        }
        if (action === 'channel-test') {
          const result = await apiFetch<{ models: Array<{ id: string }> }>(`/api/channels/${id}/test`, { method: 'POST' });
          await loadChannels();
          setNotice(`连通测试完成，模型数 ${result.models?.length ?? 0}`);
          render();
        }
        if (action === 'channel-delete') {
          await apiFetch(`/api/channels/${id}`, { method: 'DELETE' });
          await loadChannels();
          setNotice('渠道已删除');
          render();
        }
        if (action === 'channel-toggle') {
          const status = (item as HTMLElement).dataset.status === 'active' ? 'disabled' : 'active';
          await apiFetch(`/api/channels/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
          });
          await loadChannels();
          setNotice(`渠道已${status === 'active' ? '启用' : '停用'}`);
          render();
        }
        if (action === 'token-delete') {
          await apiFetch(`/api/tokens/${id}`, { method: 'DELETE' });
          await loadTokens();
          setNotice('令牌已删除');
          render();
        }
        if (action === 'token-reveal') {
          const result = await apiFetch<{ token: string | null }>(`/api/tokens/${id}/reveal`);
          setNotice(result.token ? `令牌: ${result.token}` : '未找到令牌');
        }
        if (action === 'token-toggle') {
          const status = (item as HTMLElement).dataset.status === 'active' ? 'disabled' : 'active';
          await apiFetch(`/api/tokens/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
          });
          await loadTokens();
          setNotice(`令牌已${status === 'active' ? '启用' : '停用'}`);
          render();
        }
        if (action === 'usage-refresh') {
          await loadUsage();
          setNotice('日志已刷新');
          render();
        }
      } catch (error) {
        setNotice((error as Error).message);
      }
    });
  });
}

render();

if (state.token) {
  loadTab(state.activeTab);
}
