const Mustache = require('mustache');
const xml = require('xml-mapping');
const utils = require('opensubtitles-client/lib/Utils.js');

const DEFAULT_URLS = process.env.OPENSUBTITLES_URL
  ? [process.env.OPENSUBTITLES_URL]
  : ['https://api.opensubtitles.org/xml-rpc', 'http://api.opensubtitles.org/xml-rpc'];

const LOGIN_TEMPLATE =
  '<?xml version="1.0"?><methodCall>' +
  '<methodName>LogIn</methodName>' +
  '<params>' +
  '<param><value><string>{{username}}</string></value></param>' +
  '<param><value><string>{{password}}</string></value></param>' +
  '<param><value><string>{{language}}</string></value></param>' +
  '<param><value><string>{{userAgent}}</string></value></param>' +
  '</params>' +
  '</methodCall>';

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeMembers(value) {
  if (!value) return [];
  const struct = value.struct ?? value;
  const members = struct?.member ?? struct?.members ?? struct;
  return toArray(members);
}

function getMemberString(members, name) {
  const member = normalizeMembers(members).find((item) => {
    const memberName = item?.name?.$t ?? item?.name;
    return memberName === name;
  });
  return (
    member?.value?.string?.$t ??
    member?.value?.string ??
    member?.value?.int?.$t ??
    member?.value?.i4?.$t ??
    member?.value?.$t ??
    null
  );
}

function parseLoginResponse(xmlResult) {
  let parsed;
  try {
    parsed = xml.load(xmlResult);
  } catch (err) {
    const error = new Error('OpenSubtitles login failed: invalid XML response');
    error.code = 'OPENSUBTITLES_LOGIN_INVALID_XML';
    throw error;
  }

  const faultMembers = normalizeMembers(parsed?.methodResponse?.fault?.value);
  if (faultMembers) {
    const faultString = getMemberString(faultMembers, 'faultString');
    const faultCode = getMemberString(faultMembers, 'faultCode');
    const error = new Error(
      `OpenSubtitles login failed${faultString ? `: ${faultString}` : ''}`
    );
    error.code = 'OPENSUBTITLES_LOGIN_FAILED';
    error.details = { faultCode, faultString };
    throw error;
  }

  const members = normalizeMembers(parsed?.methodResponse?.params?.param?.value);
  const token = getMemberString(members, 'token');
  if (!token) {
    const status = getMemberString(members, 'status');
    const error = new Error(
      `OpenSubtitles login failed: missing token${status ? ` (status: ${status})` : ''}`
    );
    error.code = 'OPENSUBTITLES_LOGIN_MISSING_TOKEN';
    if (process.env.OPENSUBTITLES_DEBUG === 'true') {
      error.details = { status, responsePreview: String(xmlResult).slice(0, 400) };
    } else {
      error.details = { status };
    }
    throw error;
  }

  return token;
}

async function requestWithFallback(postData, parseFn) {
  let lastError;

  for (const url of DEFAULT_URLS) {
    try {
      const response = await utils.request(url, postData);
      if (!parseFn) return response;

      try {
        return parseFn(response);
      } catch (err) {
        lastError = err;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('OpenSubtitles request failed');
}

async function login() {
  const username = process.env.OPENSUBTITLES_USER || '';
  const password = process.env.OPENSUBTITLES_PASS || '';
  const language = process.env.OPENSUBTITLES_LANG || 'en';
  const userAgent = process.env.OPENSUBTITLES_USERAGENT || 'OpenSubtitlesPlayer v4.7';

  if (!username || !password) {
    const error = new Error('OpenSubtitles login failed: credentials missing');
    error.code = 'OPENSUBTITLES_LOGIN_MISSING_CREDENTIALS';
    throw error;
  }

  const postData = Mustache.render(LOGIN_TEMPLATE, {
    username,
    password,
    language,
    userAgent
  });

  return requestWithFallback(postData, parseLoginResponse);
}

async function searchForTitle(token, lang, query) {
  const language = utils.getOpenSubtitlesLanguage(lang);
  const postData = await utils._getSearchPostData(token, language, { query });
  const response = await requestWithFallback(postData);

  try {
    return utils.parseXmlSearchResult(response);
  } catch (err) {
    const error = new Error('OpenSubtitles search failed: invalid XML response');
    error.code = 'OPENSUBTITLES_SEARCH_INVALID_XML';
    throw error;
  }
}

async function logout(token) {
  const postData = await utils._getLogoutPostData(token);
  await requestWithFallback(postData);
}

module.exports = {
  login,
  searchForTitle,
  logout
};
