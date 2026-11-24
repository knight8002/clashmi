function main(config) {
  const options = {
    japanGroup: "AI-日本自动最低延迟",
    globalGroup: "国外-自动最低延迟",
    adsGroup: "广告过滤-秋风",
    japanInterval: 900,
    globalInterval: 1800,
    timeout: 5000,
    testUrl: "https://www.gstatic.com/generate_204",
    museDomains: ["muse.ai"],
    extraDomains: []
  };
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("脚本需要 main(config) 配置对象。");
  }

  const japanPattern = "🇯🇵|日本|东京|東京|大阪|埼玉|福冈|福岡|名古屋|札幌|横滨|横浜|川崎|京都|神户|神戸|(^|[^A-Za-z])(JPN?|Japan|Tokyo|Osaka|Saitama|Fukuoka|Nagoya|Sapporo|Yokohama|Kawasaki|Kyoto|Kobe)([^A-Za-z]|$)";
  const noticePattern = "官网|剩余流量|到期|套餐|订阅|流量重置|有效期";
  const japanRegex = new RegExp(japanPattern, "i");
  const noticeRegex = new RegExp(noticePattern, "i");
  const proxies = Array.isArray(config.proxies) ? config.proxies : [];
  const groups = Array.isArray(config["proxy-groups"]) ? config["proxy-groups"] : [];
  const providerNames = Object.keys(config["proxy-providers"] || {});
  const eligible = proxies.filter(function (proxy) {
    return proxy && typeof proxy.name === "string" && !noticeRegex.test(proxy.name) &&
      !/^(direct|reject|reject-drop|dns|pass|compatible)$/i.test(proxy.type || "");
  });
  const allNames = Array.from(new Set(eligible.map(function (proxy) { return proxy.name; })));
  const japanNames = allNames.filter(function (name) { return japanRegex.test(name); });
  if (!japanNames.length && !providerNames.length) {
    throw new Error("没有找到日本节点，请检查节点名中的 日本、东京、JP、Japan 或日本国旗。");
  }
  const managedNames = [options.japanGroup, options.globalGroup, options.adsGroup];
  managedNames.forEach(function (name) {
    if (proxies.some(function (proxy) { return proxy && proxy.name === name; }) || providerNames.indexOf(name) !== -1) {
      throw new Error("策略组名称冲突：" + name);
    }
  });

  function autoGroup(name, members, interval, filter) {
    const group = {
      name: name, type: "url-test", proxies: members.slice(),
      url: options.testUrl, interval: interval, timeout: options.timeout,
      tolerance: 0, lazy: true, "max-failed-times": 1,
      "exclude-filter": noticePattern, "exclude-type": "direct|pass|dns|compatible"
    };
    if (providerNames.length) {
      group.use = providerNames;
      group.proxies.push("REJECT");
      if (filter) group.filter = "(?i)" + filter;
    }
    return group;
  }

  const domains = [
    "gemini.google.com", "aistudio.google.com", "ai.google.dev", "makersuite.google.com",
    "notebooklm.google.com", "notebooklm.google", "notebook.google.com",
    "accounts.google.com", "myaccount.google.com", "ogs.google.com", "apis.google.com",
    "googleapis.com", "googleusercontent.com", "gstatic.com",
    "chatgpt.com", "openai.com", "oaistatic.com", "oaiusercontent.com", "chat.com", "sora.com",
    "openaiapi-site.azureedge.net", "openaicom-api-bdcpf8c6d2e9atf6.z01.azurefd.net",
    "production-openaicom-storage.azureedge.net", "grok.com", "x.ai",
    "x.com", "twitter.com", "twimg.com", "t.co"
  ].concat(options.museDomains, options.extraDomains);
  const aiRules = Array.from(new Set(domains)).map(function (domain) {
    if (typeof domain !== "string" || !/^[a-z0-9.-]+$/i.test(domain) || domain.indexOf(".") === -1) {
      throw new Error("请填写纯域名，不要填写 URL：" + domain);
    }
    return "DOMAIN-SUFFIX," + domain.toLowerCase() + "," + options.japanGroup;
  });
  function ruleProvider(url, behavior, format, path) {
    return { type: "http", behavior: behavior, format: format, url: url, path: path, interval: 86400, proxy: options.globalGroup };
  }

  config.mode = "rule";
  config["proxy-groups"] = [
    autoGroup(options.japanGroup, japanNames, options.japanInterval, japanPattern),
    autoGroup(options.globalGroup, allNames, options.globalInterval, ""),
    { name: options.adsGroup, type: "select", proxies: ["REJECT", "DIRECT"] }
  ].concat(groups.filter(function (group) { return managedNames.indexOf(group.name) === -1; }));
  config["rule-providers"] = Object.assign({}, config["rule-providers"] || {}, {
    "ai-jp-awavenue-ads": ruleProvider(
      "https://raw.githubusercontent.com/TG-Twilight/AWAvenue-Ads-Rule/main/Filters/AWAvenue-Ads-Rule-Clash-Only.Ads.yaml",
      "domain", "yaml", "./ruleset/ai-jp-awavenue-only-ads.yaml"),
    "ai-jp-cn-domain": ruleProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/cn.list",
      "domain", "text", "./ruleset/ai-jp-cn-domain.list"),
    "ai-jp-cn-ip": ruleProvider(
      "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geoip/cn.list",
      "ipcidr", "text", "./ruleset/ai-jp-cn-ip.list")
  });
  config.rules = ["RULE-SET,ai-jp-awavenue-ads," + options.adsGroup].concat(aiRules, [
    "DOMAIN-SUFFIX,localhost,DIRECT", "DOMAIN-SUFFIX,local,DIRECT", "DOMAIN-SUFFIX,lan,DIRECT",
    "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve", "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve", "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
    "IP-CIDR,169.254.0.0/16,DIRECT,no-resolve", "IP-CIDR,100.64.0.0/10,DIRECT,no-resolve",
    "IP-CIDR6,::1/128,DIRECT,no-resolve", "IP-CIDR6,fc00::/7,DIRECT,no-resolve",
    "IP-CIDR6,fe80::/10,DIRECT,no-resolve",
    "DOMAIN-SUFFIX,cn,DIRECT", "DOMAIN-SUFFIX,xn--fiqs8s,DIRECT", "DOMAIN-SUFFIX,xn--fiqz9s,DIRECT",
    "RULE-SET,ai-jp-cn-domain,DIRECT", "RULE-SET,ai-jp-cn-ip,DIRECT",
    "MATCH," + options.globalGroup
  ]);
  return config;
}
