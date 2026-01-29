var w;
function N(e, i, t) {
  const s = typeof t, n = typeof e;
  if (s !== "undefined") {
    if (n !== "undefined") {
      if (t) {
        if (n === "function" && s === n) return function(o) {
          return e(t(o));
        };
        if (i = e.constructor, i === t.constructor) {
          if (i === Array) return t.concat(e);
          if (i === Map) {
            var r = new Map(t);
            for (var h of e) r.set(h[0], h[1]);
            return r;
          }
          if (i === Set) {
            h = new Set(t);
            for (r of e.values()) h.add(r);
            return h;
          }
        }
      }
      return e;
    }
    return t;
  }
  return n === "undefined" ? i : e;
}
function Y(e, i) {
  return typeof e > "u" ? i : e;
}
function L() {
  return /* @__PURE__ */ Object.create(null);
}
function E(e) {
  return typeof e == "string";
}
function oe(e) {
  return typeof e == "object";
}
function fe(e, i) {
  if (E(i)) e = e[i];
  else for (let t = 0; e && t < i.length; t++) e = e[i[t]];
  return e;
}
const ut = /[^\p{L}\p{N}]+/u, at = /(\d{3})/g, ct = /(\D)(\d{3})/g, gt = /(\d{3})(\D)/g, Ge = /[\u0300-\u036f]/g;
function ue(e = {}) {
  if (!this || this.constructor !== ue) return new ue(...arguments);
  if (arguments.length) for (e = 0; e < arguments.length; e++) this.assign(arguments[e]);
  else this.assign(e);
}
w = ue.prototype;
w.assign = function(e) {
  this.normalize = N(e.normalize, !0, this.normalize);
  let i = e.include, t = i || e.exclude || e.split, s;
  if (t || t === "") {
    if (typeof t == "object" && t.constructor !== RegExp) {
      let n = "";
      s = !i, i || (n += "\\p{Z}"), t.letter && (n += "\\p{L}"), t.number && (n += "\\p{N}", s = !!i), t.symbol && (n += "\\p{S}"), t.punctuation && (n += "\\p{P}"), t.control && (n += "\\p{C}"), (t = t.char) && (n += typeof t == "object" ? t.join("") : t);
      try {
        this.split = new RegExp("[" + (i ? "^" : "") + n + "]+", "u");
      } catch {
        this.split = /\s+/;
      }
    } else this.split = t, s = t === !1 || "a1a".split(t).length < 2;
    this.numeric = N(e.numeric, s);
  } else {
    try {
      this.split = N(this.split, ut);
    } catch {
      this.split = /\s+/;
    }
    this.numeric = N(e.numeric, N(this.numeric, !0));
  }
  if (this.prepare = N(e.prepare, null, this.prepare), this.finalize = N(e.finalize, null, this.finalize), t = e.filter, this.filter = typeof t == "function" ? t : N(t && new Set(t), null, this.filter), this.dedupe = N(e.dedupe, !0, this.dedupe), this.matcher = N((t = e.matcher) && new Map(t), null, this.matcher), this.mapper = N((t = e.mapper) && new Map(t), null, this.mapper), this.stemmer = N(
    (t = e.stemmer) && new Map(t),
    null,
    this.stemmer
  ), this.replacer = N(e.replacer, null, this.replacer), this.minlength = N(e.minlength, 1, this.minlength), this.maxlength = N(e.maxlength, 1024, this.maxlength), this.rtl = N(e.rtl, !1, this.rtl), (this.cache = t = N(e.cache, !0, this.cache)) && (this.F = null, this.L = typeof t == "number" ? t : 2e5, this.B = /* @__PURE__ */ new Map(), this.D = /* @__PURE__ */ new Map(), this.I = this.H = 128), this.h = "", this.J = null, this.A = "", this.K = null, this.matcher) for (const n of this.matcher.keys()) this.h += (this.h ? "|" : "") + n;
  if (this.stemmer) for (const n of this.stemmer.keys()) this.A += (this.A ? "|" : "") + n;
  return this;
};
w.addStemmer = function(e, i) {
  return this.stemmer || (this.stemmer = /* @__PURE__ */ new Map()), this.stemmer.set(e, i), this.A += (this.A ? "|" : "") + e, this.K = null, this.cache && V(this), this;
};
w.addFilter = function(e) {
  return typeof e == "function" ? this.filter = e : (this.filter || (this.filter = /* @__PURE__ */ new Set()), this.filter.add(e)), this.cache && V(this), this;
};
w.addMapper = function(e, i) {
  return typeof e == "object" ? this.addReplacer(e, i) : e.length > 1 ? this.addMatcher(e, i) : (this.mapper || (this.mapper = /* @__PURE__ */ new Map()), this.mapper.set(e, i), this.cache && V(this), this);
};
w.addMatcher = function(e, i) {
  return typeof e == "object" ? this.addReplacer(e, i) : e.length < 2 && (this.dedupe || this.mapper) ? this.addMapper(e, i) : (this.matcher || (this.matcher = /* @__PURE__ */ new Map()), this.matcher.set(e, i), this.h += (this.h ? "|" : "") + e, this.J = null, this.cache && V(this), this);
};
w.addReplacer = function(e, i) {
  return typeof e == "string" ? this.addMatcher(e, i) : (this.replacer || (this.replacer = []), this.replacer.push(e, i), this.cache && V(this), this);
};
w.encode = function(e, i) {
  if (this.cache && e.length <= this.H) if (this.F) {
    if (this.B.has(e)) return this.B.get(e);
  } else this.F = setTimeout(V, 50, this);
  this.normalize && (typeof this.normalize == "function" ? e = this.normalize(e) : e = Ge ? e.normalize("NFKD").replace(Ge, "").toLowerCase() : e.toLowerCase()), this.prepare && (e = this.prepare(e)), this.numeric && e.length > 3 && (e = e.replace(ct, "$1 $2").replace(gt, "$1 $2").replace(at, "$1 "));
  const t = !(this.dedupe || this.mapper || this.filter || this.matcher || this.stemmer || this.replacer);
  let s = [], n = L(), r, h, o = this.split || this.split === "" ? e.split(this.split) : [e];
  for (let f = 0, u, c; f < o.length; f++) if ((u = c = o[f]) && !(u.length < this.minlength || u.length > this.maxlength)) {
    if (i) {
      if (n[u]) continue;
      n[u] = 1;
    } else {
      if (r === u) continue;
      r = u;
    }
    if (t) s.push(u);
    else if (!this.filter || (typeof this.filter == "function" ? this.filter(u) : !this.filter.has(u))) {
      if (this.cache && u.length <= this.I) if (this.F) {
        var l = this.D.get(u);
        if (l || l === "") {
          l && s.push(l);
          continue;
        }
      } else this.F = setTimeout(V, 50, this);
      if (this.stemmer) {
        this.K || (this.K = new RegExp("(?!^)(" + this.A + ")$"));
        let m;
        for (; m !== u && u.length > 2; ) m = u, u = u.replace(this.K, (d) => this.stemmer.get(d));
      }
      if (u && (this.mapper || this.dedupe && u.length > 1)) {
        l = "";
        for (let m = 0, d = "", p, a; m < u.length; m++) p = u.charAt(m), p === d && this.dedupe || ((a = this.mapper && this.mapper.get(p)) || a === "" ? a === d && this.dedupe || !(d = a) || (l += a) : l += d = p);
        u = l;
      }
      if (this.matcher && u.length > 1 && (this.J || (this.J = new RegExp("(" + this.h + ")", "g")), u = u.replace(this.J, (m) => this.matcher.get(m))), u && this.replacer) for (l = 0; u && l < this.replacer.length; l += 2) u = u.replace(
        this.replacer[l],
        this.replacer[l + 1]
      );
      if (this.cache && c.length <= this.I && (this.D.set(c, u), this.D.size > this.L && (this.D.clear(), this.I = this.I / 1.1 | 0)), u) {
        if (u !== c) if (i) {
          if (n[u]) continue;
          n[u] = 1;
        } else {
          if (h === u) continue;
          h = u;
        }
        s.push(u);
      }
    }
  }
  return this.finalize && (s = this.finalize(s) || s), this.cache && e.length <= this.H && (this.B.set(e, s), this.B.size > this.L && (this.B.clear(), this.H = this.H / 1.1 | 0)), s;
};
function V(e) {
  e.F = null, e.B.clear(), e.D.clear();
}
function Le(e, i, t) {
  t || (i || typeof e != "object" ? typeof i == "object" && (t = i, i = 0) : t = e), t && (e = t.query || e, i = t.limit || i);
  let s = "" + (i || 0);
  t && (s += (t.offset || 0) + !!t.context + !!t.suggest + (t.resolve !== !1) + (t.resolution || this.resolution) + (t.boost || 0)), e = ("" + e).toLowerCase(), this.cache || (this.cache = new X());
  let n = this.cache.get(e + s);
  if (!n) {
    const r = t && t.cache;
    r && (t.cache = !1), n = this.search(e, i, t), r && (t.cache = r), this.cache.set(e + s, n);
  }
  return n;
}
function X(e) {
  this.limit = e && e !== !0 ? e : 1e3, this.cache = /* @__PURE__ */ new Map(), this.h = "";
}
X.prototype.set = function(e, i) {
  this.cache.set(this.h = e, i), this.cache.size > this.limit && this.cache.delete(this.cache.keys().next().value);
};
X.prototype.get = function(e) {
  const i = this.cache.get(e);
  return i && this.h !== e && (this.cache.delete(e), this.cache.set(this.h = e, i)), i;
};
X.prototype.remove = function(e) {
  for (const i of this.cache) {
    const t = i[0];
    i[1].includes(e) && this.cache.delete(t);
  }
};
X.prototype.clear = function() {
  this.cache.clear(), this.h = "";
};
const He = { normalize: !1, numeric: !1, dedupe: !1 }, de = {}, Me = /* @__PURE__ */ new Map([["b", "p"], ["v", "f"], ["w", "f"], ["z", "s"], ["x", "s"], ["d", "t"], ["n", "m"], ["c", "k"], ["g", "k"], ["j", "k"], ["q", "k"], ["i", "e"], ["y", "e"], ["u", "o"]]), Te = /* @__PURE__ */ new Map([["ae", "a"], ["oe", "o"], ["sh", "s"], ["kh", "k"], ["th", "t"], ["ph", "f"], ["pf", "f"]]), We = [/([^aeo])h(.)/g, "$1$2", /([aeo])h([^aeo]|$)/g, "$1$2", /(.)\1+/g, "$1"], Pe = { a: "", e: "", i: "", o: "", u: "", y: "", b: 1, f: 1, p: 1, v: 1, c: 2, g: 2, j: 2, k: 2, q: 2, s: 2, x: 2, z: 2, ß: 2, d: 3, t: 3, l: 4, m: 5, n: 5, r: 6 };
var Ie = { Exact: He, Default: de, Normalize: de, LatinBalance: { mapper: Me }, LatinAdvanced: { mapper: Me, matcher: Te, replacer: We }, LatinExtra: { mapper: Me, replacer: We.concat([/(?!^)[aeo]/g, ""]), matcher: Te }, LatinSoundex: { dedupe: !1, include: { letter: !0 }, finalize: function(e) {
  for (let t = 0; t < e.length; t++) {
    var i = e[t];
    let s = i.charAt(0), n = Pe[s];
    for (let r = 1, h; r < i.length && (h = i.charAt(r), h === "h" || h === "w" || !(h = Pe[h]) || h === n || (s += h, n = h, s.length !== 4)); r++) ;
    e[t] = s;
  }
} }, CJK: { split: "" }, LatinExact: He, LatinDefault: de, LatinSimple: de };
function Se(e, i, t, s) {
  let n = [];
  for (let r = 0, h; r < e.index.length; r++) if (h = e.index[r], i >= h.length) i -= h.length;
  else {
    i = h[s ? "splice" : "slice"](i, t);
    const o = i.length;
    if (o && (n = n.length ? n.concat(i) : i, t -= o, s && (e.length -= o), !t)) break;
    i = 0;
  }
  return n;
}
function te(e) {
  if (!this || this.constructor !== te) return new te(e);
  this.index = e ? [e] : [], this.length = e ? e.length : 0;
  const i = this;
  return new Proxy([], { get(t, s) {
    if (s === "length") return i.length;
    if (s === "push") return function(n) {
      i.index[i.index.length - 1].push(n), i.length++;
    };
    if (s === "pop") return function() {
      if (i.length) return i.length--, i.index[i.index.length - 1].pop();
    };
    if (s === "indexOf") return function(n) {
      let r = 0;
      for (let h = 0, o, l; h < i.index.length; h++) {
        if (o = i.index[h], l = o.indexOf(n), l >= 0) return r + l;
        r += o.length;
      }
      return -1;
    };
    if (s === "includes") return function(n) {
      for (let r = 0; r < i.index.length; r++) if (i.index[r].includes(n)) return !0;
      return !1;
    };
    if (s === "slice") return function(n, r) {
      return Se(i, n || 0, r || i.length, !1);
    };
    if (s === "splice") return function(n, r) {
      return Se(i, n || 0, r || i.length, !0);
    };
    if (s === "constructor") return Array;
    if (typeof s != "symbol") return (t = i.index[s / 2 ** 31 | 0]) && t[s];
  }, set(t, s, n) {
    return t = s / 2 ** 31 | 0, (i.index[t] || (i.index[t] = []))[s] = n, i.length++, !0;
  } });
}
te.prototype.clear = function() {
  this.index.length = 0;
};
te.prototype.push = function() {
};
function $(e = 8) {
  if (!this || this.constructor !== $) return new $(e);
  this.index = L(), this.h = [], this.size = 0, e > 32 ? (this.B = et, this.A = BigInt(e)) : (this.B = Ze, this.A = e);
}
$.prototype.get = function(e) {
  const i = this.index[this.B(e)];
  return i && i.get(e);
};
$.prototype.set = function(e, i) {
  var t = this.B(e);
  let s = this.index[t];
  s ? (t = s.size, s.set(e, i), (t -= s.size) && this.size++) : (this.index[t] = s = /* @__PURE__ */ new Map([[e, i]]), this.h.push(s), this.size++);
};
function _(e = 8) {
  if (!this || this.constructor !== _) return new _(e);
  this.index = L(), this.h = [], this.size = 0, e > 32 ? (this.B = et, this.A = BigInt(e)) : (this.B = Ze, this.A = e);
}
_.prototype.add = function(e) {
  var i = this.B(e);
  let t = this.index[i];
  t ? (i = t.size, t.add(e), (i -= t.size) && this.size++) : (this.index[i] = t = /* @__PURE__ */ new Set([e]), this.h.push(t), this.size++);
};
w = $.prototype;
w.has = _.prototype.has = function(e) {
  const i = this.index[this.B(e)];
  return i && i.has(e);
};
w.delete = _.prototype.delete = function(e) {
  const i = this.index[this.B(e)];
  i && i.delete(e) && this.size--;
};
w.clear = _.prototype.clear = function() {
  this.index = L(), this.h = [], this.size = 0;
};
w.values = _.prototype.values = function* () {
  for (let e = 0; e < this.h.length; e++) for (let i of this.h[e].values()) yield i;
};
w.keys = _.prototype.keys = function* () {
  for (let e = 0; e < this.h.length; e++) for (let i of this.h[e].keys()) yield i;
};
w.entries = _.prototype.entries = function* () {
  for (let e = 0; e < this.h.length; e++) for (let i of this.h[e].entries()) yield i;
};
function Ze(e) {
  let i = 2 ** this.A - 1;
  if (typeof e == "number") return e & i;
  let t = 0, s = this.A + 1;
  for (let n = 0; n < e.length; n++) t = (t * s ^ e.charCodeAt(n)) & i;
  return this.A === 32 ? t + 2 ** 31 : t;
}
function et(e) {
  let i = BigInt(2) ** this.A - BigInt(1);
  var t = typeof e;
  if (t === "bigint") return e & i;
  if (t === "number") return BigInt(e) & i;
  t = BigInt(0);
  let s = this.A + BigInt(1);
  for (let n = 0; n < e.length; n++) t = (t * s ^ BigInt(e.charCodeAt(n))) & i;
  return t;
}
let K, he;
async function dt(e) {
  e = e.data;
  var i = e.task;
  const t = e.id;
  let s = e.args;
  switch (i) {
    case "init":
      he = e.options || {}, (i = e.factory) ? (Function("return " + i)()(self), K = new self.FlexSearch.Index(he), delete self.FlexSearch) : K = new G(he), postMessage({ id: t });
      break;
    default:
      let n;
      i === "export" && (s[1] ? (s[0] = he.export, s[2] = 0, s[3] = 1) : s = null), i === "import" ? s[0] && (e = await he.import.call(K, s[0]), K.import(s[0], e)) : ((n = s && K[i].apply(K, s)) && n.then && (n = await n), n && n.await && (n = await n.await), i === "search" && n.result && (n = n.result)), postMessage(i === "search" ? { id: t, msg: n } : { id: t });
  }
}
function Fe(e) {
  Z.call(e, "add"), Z.call(e, "append"), Z.call(e, "search"), Z.call(e, "update"), Z.call(e, "remove"), Z.call(e, "searchCache");
}
let Oe, Ue, ye;
function pt() {
  Oe = ye = 0;
}
function Z(e) {
  this[e + "Async"] = function() {
    const i = arguments;
    var t = i[i.length - 1];
    let s;
    if (typeof t == "function" && (s = t, delete i[i.length - 1]), Oe ? ye || (ye = Date.now() - Ue >= this.priority * this.priority * 3) : (Oe = setTimeout(pt, 0), Ue = Date.now()), ye) {
      const r = this;
      return new Promise((h) => {
        setTimeout(function() {
          h(r[e + "Async"].apply(r, i));
        }, 0);
      });
    }
    const n = this[e].apply(this, i);
    return t = n.then ? n : new Promise((r) => r(n)), s && t.then(s), t;
  };
}
let W = 0;
function ie(e = {}, i) {
  function t(o) {
    function l(f) {
      f = f.data || f;
      const u = f.id, c = u && r.h[u];
      c && (c(f.msg), delete r.h[u]);
    }
    if (this.worker = o, this.h = L(), this.worker)
      return n ? this.worker.on("message", l) : this.worker.onmessage = l, e.config ? new Promise(function(f) {
        W > 1e9 && (W = 0), r.h[++W] = function() {
          f(r);
        }, r.worker.postMessage({ id: W, task: "init", factory: s, options: e });
      }) : (this.priority = e.priority || 4, this.encoder = i || null, this.worker.postMessage({ task: "init", factory: s, options: e }), this);
  }
  if (!this || this.constructor !== ie) return new ie(e);
  let s = typeof self < "u" ? self._factory : typeof window < "u" ? window._factory : null;
  s && (s = s.toString());
  const n = typeof window > "u", r = this, h = mt(s, n, e.worker);
  return h.then ? h.then(function(o) {
    return t.call(r, o);
  }) : t.call(this, h);
}
P("add");
P("append");
P("search");
P("update");
P("remove");
P("clear");
P("export");
P("import");
ie.prototype.searchCache = Le;
Fe(ie.prototype);
function P(e) {
  ie.prototype[e] = function() {
    const i = this, t = [].slice.call(arguments);
    var s = t[t.length - 1];
    let n;
    return typeof s == "function" && (n = s, t.pop()), s = new Promise(function(r) {
      e === "export" && typeof t[0] == "function" && (t[0] = null), W > 1e9 && (W = 0), i.h[++W] = r, i.worker.postMessage({ task: e, id: W, args: t });
    }), n ? (s.then(n), this) : s;
  };
}
function mt(e, i, t) {
  return i ? typeof module < "u" ? new (require("worker_threads")).Worker(__dirname + "/worker/node.js") : Promise.resolve().then(function() {
    return Bt;
  }).then(function(s) {
    return new s.Worker(import.meta.dirname + "/node/node.mjs");
  }) : e ? new window.Worker(URL.createObjectURL(new Blob(["onmessage=" + dt.toString()], { type: "text/javascript" }))) : new window.Worker(typeof t == "string" ? t : import.meta.url.replace("/worker.js", "/worker/worker.js").replace(
    "flexsearch.bundle.module.min.js",
    "module/worker/worker.js"
  ).replace("flexsearch.bundle.module.min.mjs", "module/worker/worker.js"), { type: "module" });
}
ne.prototype.add = function(e, i, t) {
  if (oe(e) && (i = e, e = fe(i, this.key)), i && (e || e === 0)) {
    if (!t && this.reg.has(e)) return this.update(e, i);
    for (let o = 0, l; o < this.field.length; o++) {
      l = this.B[o];
      var s = this.index.get(this.field[o]);
      if (typeof l == "function") {
        var n = l(i);
        n && s.add(e, n, t, !0);
      } else n = l.G, (!n || n(i)) && (l.constructor === String ? l = ["" + l] : E(l) && (l = [l]), Ce(i, l, this.D, 0, s, e, l[0], t));
    }
    if (this.tag) for (s = 0; s < this.A.length; s++) {
      var r = this.A[s];
      n = this.tag.get(this.F[s]);
      let o = L();
      if (typeof r == "function") {
        if (r = r(i), !r) continue;
      } else {
        var h = r.G;
        if (h && !h(i)) continue;
        r.constructor === String && (r = "" + r), r = fe(i, r);
      }
      if (n && r) {
        E(r) && (r = [r]);
        for (let l = 0, f, u; l < r.length; l++) if (f = r[l], !o[f] && (o[f] = 1, (h = n.get(f)) ? u = h : n.set(f, u = []), !t || !u.includes(e))) {
          if (u.length === 2 ** 31 - 1) {
            if (h = new te(u), this.fastupdate) for (let c of this.reg.values()) c.includes(u) && (c[c.indexOf(u)] = h);
            n.set(f, u = h);
          }
          u.push(e), this.fastupdate && ((h = this.reg.get(e)) ? h.push(u) : this.reg.set(e, [u]));
        }
      }
    }
    if (this.store && (!t || !this.store.has(e))) {
      let o;
      if (this.h) {
        o = L();
        for (let l = 0, f; l < this.h.length; l++) {
          if (f = this.h[l], (t = f.G) && !t(i)) continue;
          let u;
          if (typeof f == "function") {
            if (u = f(i), !u) continue;
            f = [f.O];
          } else if (E(f) || f.constructor === String) {
            o[f] = i[f];
            continue;
          }
          Be(i, o, f, 0, f[0], u);
        }
      }
      this.store.set(e, o || i);
    }
    this.worker && (this.fastupdate || this.reg.add(e));
  }
  return this;
};
function Be(e, i, t, s, n, r) {
  if (e = e[n], s === t.length - 1) i[n] = r || e;
  else if (e) if (e.constructor === Array) for (i = i[n] = Array(e.length), n = 0; n < e.length; n++) Be(e, i, t, s, n);
  else i = i[n] || (i[n] = L()), n = t[++s], Be(e, i, t, s, n);
}
function Ce(e, i, t, s, n, r, h, o) {
  if (e = e[h]) if (s === i.length - 1) {
    if (e.constructor === Array) {
      if (t[s]) {
        for (i = 0; i < e.length; i++) n.add(r, e[i], !0, !0);
        return;
      }
      e = e.join(" ");
    }
    n.add(r, e, o, !0);
  } else if (e.constructor === Array) for (h = 0; h < e.length; h++) Ce(e, i, t, s, n, r, h, o);
  else h = i[++s], Ce(e, i, t, s, n, r, h, o);
}
function Ne(e, i, t, s) {
  if (!e.length) return e;
  if (e.length === 1) return e = e[0], e = t || e.length > i ? e.slice(t, t + i) : e, s ? ee.call(this, e) : e;
  let n = [];
  for (let r = 0, h, o; r < e.length; r++) if ((h = e[r]) && (o = h.length)) {
    if (t) {
      if (t >= o) {
        t -= o;
        continue;
      }
      h = h.slice(t, t + i), o = h.length, t = 0;
    }
    if (o > i && (h = h.slice(0, i), o = i), !n.length && o >= i) return s ? ee.call(this, h) : h;
    if (n.push(h), i -= o, !i) break;
  }
  return n = n.length > 1 ? [].concat.apply([], n) : n[0], s ? ee.call(this, n) : n;
}
function Ae(e, i, t, s) {
  var n = s[0];
  if (n[0] && n[0].query) return e[i].apply(e, n);
  if (!(i !== "and" && i !== "not" || e.result.length || e.await || n.suggest)) return s.length > 1 && (n = s[s.length - 1]), (s = n.resolve) ? e.await || e.result : e;
  let r = [], h = 0, o = 0, l, f, u, c, m;
  for (i = 0; i < s.length; i++) if (n = s[i]) {
    var d = void 0;
    if (n.constructor === C) d = n.await || n.result;
    else if (n.then || n.constructor === Array) d = n;
    else {
      h = n.limit || 0, o = n.offset || 0, u = n.suggest, f = n.resolve, l = ((c = n.highlight || e.highlight) || n.enrich) && f, d = n.queue;
      let p = n.async || d, a = n.index, g = n.query;
      if (a ? e.index || (e.index = a) : a = e.index, g || n.tag) {
        const b = n.field || n.pluck;
        if (b && (!g || e.query && !c || (e.query = g, e.field = b, e.highlight = c), a = a.index.get(b)), d && (m || e.await)) {
          m = 1;
          let y;
          const k = e.C.length, z = new Promise(function(O) {
            y = O;
          });
          (function(O, M) {
            z.h = function() {
              M.index = null, M.resolve = !1;
              let A = p ? O.searchAsync(M) : O.search(M);
              return A.then ? A.then(function(x) {
                return e.C[k] = x = x.result || x, y(x), x;
              }) : (A = A.result || A, y(A), A);
            };
          })(a, Object.assign({}, n)), e.C.push(z), r[i] = z;
          continue;
        } else n.resolve = !1, n.index = null, d = p ? a.searchAsync(n) : a.search(n), n.resolve = f, n.index = a;
      } else if (n.and) d = pe(n, "and", a);
      else if (n.or) d = pe(n, "or", a);
      else if (n.not) d = pe(n, "not", a);
      else if (n.xor) d = pe(n, "xor", a);
      else continue;
    }
    d.await ? (m = 1, d = d.await) : d.then ? (m = 1, d = d.then(function(p) {
      return p.result || p;
    })) : d = d.result || d, r[i] = d;
  }
  if (m && !e.await && (e.await = new Promise(function(p) {
    e.return = p;
  })), m) {
    const p = Promise.all(r).then(function(a) {
      for (let g = 0; g < e.C.length; g++) if (e.C[g] === p) {
        e.C[g] = function() {
          return t.call(e, a, h, o, l, f, u, c);
        };
        break;
      }
      Je(e);
    });
    e.C.push(p);
  } else if (e.await) e.C.push(function() {
    return t.call(e, r, h, o, l, f, u, c);
  });
  else return t.call(e, r, h, o, l, f, u, c);
  return f ? e.await || e.result : e;
}
function pe(e, i, t) {
  e = e[i];
  const s = e[0] || e;
  return s.index || (s.index = t), t = new C(s), e.length > 1 && (t = t[i].apply(t, e.slice(1))), t;
}
C.prototype.or = function() {
  return Ae(this, "or", yt, arguments);
};
function yt(e, i, t, s, n, r, h) {
  return e.length && (this.result.length && e.push(this.result), e.length < 2 ? this.result = e[0] : (this.result = tt(e, i, t, !1, this.h), t = 0)), n && (this.await = null), n ? this.resolve(i, t, s, h) : this;
}
C.prototype.and = function() {
  return Ae(this, "and", wt, arguments);
};
function wt(e, i, t, s, n, r, h) {
  if (!r && !this.result.length) return n ? this.result : this;
  let o;
  if (e.length) if (this.result.length && e.unshift(this.result), e.length < 2) this.result = e[0];
  else {
    let l = 0;
    for (let f = 0, u, c; f < e.length; f++) if ((u = e[f]) && (c = u.length)) l < c && (l = c);
    else if (!r) {
      l = 0;
      break;
    }
    l ? (this.result = be(e, l, i, t, r, this.h, n), o = !0) : this.result = [];
  }
  else r || (this.result = e);
  return n && (this.await = null), n ? this.resolve(i, t, s, h, o) : this;
}
C.prototype.xor = function() {
  return Ae(this, "xor", bt, arguments);
};
function bt(e, i, t, s, n, r, h) {
  if (e.length) if (this.result.length && e.unshift(this.result), e.length < 2) this.result = e[0];
  else {
    e: {
      r = t;
      var o = this.h;
      const l = [], f = L();
      let u = 0;
      for (let c = 0, m; c < e.length; c++) if (m = e[c]) {
        u < m.length && (u = m.length);
        for (let d = 0, p; d < m.length; d++) if (p = m[d]) for (let a = 0, g; a < p.length; a++) g = p[a], f[g] = f[g] ? 2 : 1;
      }
      for (let c = 0, m, d = 0; c < u; c++) for (let p = 0, a; p < e.length; p++) if ((a = e[p]) && (m = a[c])) {
        for (let g = 0, b; g < m.length; g++) if (b = m[g], f[b] === 1) if (r) r--;
        else if (n) {
          if (l.push(b), l.length === i) {
            e = l;
            break e;
          }
        } else {
          const y = c + (p ? o : 0);
          if (l[y] || (l[y] = []), l[y].push(b), ++d === i) {
            e = l;
            break e;
          }
        }
      }
      e = l;
    }
    this.result = e, o = !0;
  }
  else r || (this.result = e);
  return n && (this.await = null), n ? this.resolve(i, t, s, h, o) : this;
}
C.prototype.not = function() {
  return Ae(this, "not", xt, arguments);
};
function xt(e, i, t, s, n, r, h) {
  if (!r && !this.result.length) return n ? this.result : this;
  if (e.length && this.result.length) {
    e: {
      r = t;
      var o = [];
      e = new Set(e.flat().flat());
      for (let l = 0, f, u = 0; l < this.result.length; l++) if (f = this.result[l]) {
        for (let c = 0, m; c < f.length; c++) if (m = f[c], !e.has(m)) {
          if (r) r--;
          else if (n) {
            if (o.push(m), o.length === i) {
              e = o;
              break e;
            }
          } else if (o[l] || (o[l] = []), o[l].push(m), ++u === i) {
            e = o;
            break e;
          }
        }
      }
      e = o;
    }
    this.result = e, o = !0;
  }
  return n && (this.await = null), n ? this.resolve(i, t, s, h, o) : this;
}
function we(e, i, t, s, n) {
  let r, h, o;
  typeof n == "string" ? (r = n, n = "") : r = n.template, h = r.indexOf("$1"), o = r.substring(h + 2), h = r.substring(0, h);
  let l = n && n.boundary, f = !n || n.clip !== !1, u = n && n.merge && o && h && new RegExp(o + " " + h, "g");
  n = n && n.ellipsis;
  var c = 0;
  if (typeof n == "object") {
    var m = n.template;
    c = m.length - 2, n = n.pattern;
  }
  typeof n != "string" && (n = n === !1 ? "" : "..."), c && (n = m.replace("$1", n)), m = n.length - c;
  let d, p;
  typeof l == "object" && (d = l.before, d === 0 && (d = -1), p = l.after, p === 0 && (p = -1), l = l.total || 9e5), c = /* @__PURE__ */ new Map();
  for (let je = 0, U, $e, se; je < i.length; je++) {
    let re;
    if (s) re = i, se = s;
    else {
      var a = i[je];
      if (se = a.field, !se) continue;
      re = a.result;
    }
    $e = t.get(se), U = $e.encoder, a = c.get(U), typeof a != "string" && (a = U.encode(e), c.set(U, a));
    for (let ce = 0; ce < re.length; ce++) {
      var g = re[ce].doc;
      if (!g || (g = fe(g, se), !g)) continue;
      var b = g.trim().split(/\s+/);
      if (!b.length) continue;
      g = "";
      var y = [];
      let ge = [];
      for (var k = -1, z = -1, O = 0, M = 0; M < b.length; M++) {
        var A = b[M], x = U.encode(A);
        x = x.length > 1 ? x.join(" ") : x[0];
        let v;
        if (x && A) {
          for (var j = A.length, D = (U.split ? A.replace(U.split, "") : A).length - x.length, B = "", F = 0, J = 0; J < a.length; J++) {
            var R = a[J];
            if (R) {
              var I = R.length;
              I += D < 0 ? 0 : D, F && I <= F || (R = x.indexOf(R), R > -1 && (B = (R ? A.substring(0, R) : "") + h + A.substring(R, R + I) + o + (R + I < j ? A.substring(R + I) : ""), F = I, v = !0));
            }
          }
          B && (l && (k < 0 && (k = g.length + (g ? 1 : 0)), z = g.length + (g ? 1 : 0) + B.length, O += j, ge.push(y.length), y.push({ match: B })), g += (g ? " " : "") + B);
        }
        if (!v) A = b[M], g += (g ? " " : "") + A, l && y.push({ text: A });
        else if (l && O >= l) break;
      }
      if (O = ge.length * (r.length - 2), d || p || l && g.length - O > l) if (O = l + O - m * 2, M = z - k, d > 0 && (M += d), p > 0 && (M += p), M <= O) b = d ? k - (d > 0 ? d : 0) : k - ((O - M) / 2 | 0), y = p ? z + (p > 0 ? p : 0) : b + O, f || (b > 0 && g.charAt(b) !== " " && g.charAt(b - 1) !== " " && (b = g.indexOf(" ", b), b < 0 && (b = 0)), y < g.length && g.charAt(y - 1) !== " " && g.charAt(y) !== " " && (y = g.lastIndexOf(" ", y), y < z ? y = z : ++y)), g = (b ? n : "") + g.substring(b, y) + (y < g.length ? n : "");
      else {
        for (z = [], k = {}, O = {}, M = {}, A = {}, x = {}, B = D = j = 0, J = F = 1; ; ) {
          var H = void 0;
          for (let v = 0, q; v < ge.length; v++) {
            if (q = ge[v], B) if (D !== B) {
              if (M[v + 1]) continue;
              if (q += B, k[q]) {
                j -= m, O[v + 1] = 1, M[v + 1] = 1;
                continue;
              }
              if (q >= y.length - 1) {
                if (q >= y.length) {
                  M[v + 1] = 1, q >= b.length && (O[v + 1] = 1);
                  continue;
                }
                j -= m;
              }
              if (g = y[q].text, I = p && x[v]) if (I > 0) {
                if (g.length > I) if (M[v + 1] = 1, f) g = g.substring(0, I);
                else continue;
                (I -= g.length) || (I = -1), x[v] = I;
              } else {
                M[v + 1] = 1;
                continue;
              }
              if (j + g.length + 1 <= l) g = " " + g, z[v] += g;
              else if (f) H = l - j - 1, H > 0 && (g = " " + g.substring(0, H), z[v] += g), M[v + 1] = 1;
              else {
                M[v + 1] = 1;
                continue;
              }
            } else {
              if (M[v]) continue;
              if (q -= D, k[q]) {
                j -= m, M[v] = 1, O[v] = 1;
                continue;
              }
              if (q <= 0) {
                if (q < 0) {
                  M[v] = 1, O[v] = 1;
                  continue;
                }
                j -= m;
              }
              if (g = y[q].text, I = d && A[v]) if (I > 0) {
                if (g.length > I) if (M[v] = 1, f) g = g.substring(g.length - I);
                else continue;
                (I -= g.length) || (I = -1), A[v] = I;
              } else {
                M[v] = 1;
                continue;
              }
              if (j + g.length + 1 <= l) g += " ", z[v] = g + z[v];
              else if (f) H = g.length + 1 - (l - j), H >= 0 && H < g.length && (g = g.substring(H) + " ", z[v] = g + z[v]), M[v] = 1;
              else {
                M[v] = 1;
                continue;
              }
            }
            else {
              g = y[q].match, d && (A[v] = d), p && (x[v] = p), v && j++;
              let _e;
              if (q ? !v && m && (j += m) : (O[v] = 1, M[v] = 1), q >= b.length - 1 || q < y.length - 1 && y[q + 1].match ? _e = 1 : m && (j += m), j -= r.length - 2, !v || j + g.length <= l) z[v] = g;
              else {
                H = F = J = O[v] = 0;
                break;
              }
              _e && (O[v + 1] = 1, M[v + 1] = 1);
            }
            j += g.length, H = k[q] = 1;
          }
          if (H) D === B ? B++ : D++;
          else {
            if (D === B ? F = 0 : J = 0, !F && !J) break;
            F ? (D++, B = D) : B++;
          }
        }
        g = "";
        for (let v = 0, q; v < z.length; v++) q = (O[v] ? v ? " " : "" : (v && !n ? " " : "") + n) + z[v], g += q;
        n && !O[z.length] && (g += n);
      }
      u && (g = g.replace(u, " ")), re[ce].highlight = g;
    }
    if (s) break;
  }
  return i;
}
function C(e, i) {
  if (!this || this.constructor !== C) return new C(e, i);
  let t = 0, s, n, r, h, o, l;
  if (e && e.index) {
    const f = e;
    if (i = f.index, t = f.boost || 0, n = f.query) {
      r = f.field || f.pluck, h = f.highlight;
      const u = f.resolve;
      e = f.async || f.queue, f.resolve = !1, f.index = null, e = e ? i.searchAsync(f) : i.search(f), f.resolve = u, f.index = i, e = e.result || e;
    } else e = [];
  }
  if (e && e.then) {
    const f = this;
    e = e.then(function(u) {
      f.C[0] = f.result = u.result || u, Je(f);
    }), s = [e], e = [], o = new Promise(function(u) {
      l = u;
    });
  }
  this.index = i || null, this.result = e || [], this.h = t, this.C = s || [], this.await = o || null, this.return = l || null, this.highlight = h || null, this.query = n || "", this.field = r || "";
}
w = C.prototype;
w.limit = function(e) {
  if (this.await) {
    const i = this;
    this.C.push(function() {
      return i.limit(e).result;
    });
  } else if (this.result.length) {
    const i = [];
    for (let t = 0, s; t < this.result.length; t++) if (s = this.result[t]) if (s.length <= e) {
      if (i[t] = s, e -= s.length, !e) break;
    } else {
      i[t] = s.slice(0, e);
      break;
    }
    this.result = i;
  }
  return this;
};
w.offset = function(e) {
  if (this.await) {
    const i = this;
    this.C.push(function() {
      return i.offset(e).result;
    });
  } else if (this.result.length) {
    const i = [];
    for (let t = 0, s; t < this.result.length; t++) (s = this.result[t]) && (s.length <= e ? e -= s.length : (i[t] = s.slice(e), e = 0));
    this.result = i;
  }
  return this;
};
w.boost = function(e) {
  if (this.await) {
    const i = this;
    this.C.push(function() {
      return i.boost(e).result;
    });
  } else this.h += e;
  return this;
};
function Je(e, i) {
  let t = e.result;
  var s = e.await;
  e.await = null;
  for (let n = 0, r; n < e.C.length; n++) if (r = e.C[n]) {
    if (typeof r == "function") t = r(), e.C[n] = t = t.result || t, n--;
    else if (r.h) t = r.h(), e.C[n] = t = t.result || t, n--;
    else if (r.then) return e.await = s;
  }
  return s = e.return, e.C = [], e.return = null, i || s(t), t;
}
w.resolve = function(e, i, t, s, n) {
  let r = this.await ? Je(this, !0) : this.result;
  if (r.then) {
    const h = this;
    return r.then(function() {
      return h.resolve(e, i, t, s, n);
    });
  }
  return r.length && (typeof e == "object" ? (s = e.highlight || this.highlight, t = !!s || e.enrich, i = e.offset, e = e.limit) : (s = s || this.highlight, t = !!s || t), r = n ? t ? ee.call(this.index, r) : r : Ne.call(this.index, r, e || 100, i, t)), this.finalize(r, s);
};
w.finalize = function(e, i) {
  if (e.then) {
    const s = this;
    return e.then(function(n) {
      return s.finalize(n, i);
    });
  }
  i && e.length && this.query && (e = we(this.query, e, this.index.index, this.field, i));
  const t = this.return;
  return this.highlight = this.index = this.result = this.C = this.await = this.return = null, this.query = this.field = "", t && t(e), e;
};
function be(e, i, t, s, n, r, h) {
  const o = e.length;
  let l = [], f, u;
  f = L();
  for (let c = 0, m, d, p, a; c < i; c++) for (let g = 0; g < o; g++) if (p = e[g], c < p.length && (m = p[c])) for (let b = 0; b < m.length; b++) {
    if (d = m[b], (u = f[d]) ? f[d]++ : (u = 0, f[d] = 1), a = l[u] || (l[u] = []), !h) {
      let y = c + (g || !n ? 0 : r || 0);
      a = a[y] || (a[y] = []);
    }
    if (a.push(d), h && t && u === o - 1 && a.length - s === t) return s ? a.slice(s) : a;
  }
  if (e = l.length) if (n) l = l.length > 1 ? tt(l, t, s, h, r) : (l = l[0]) && t && l.length > t || s ? l.slice(s, t + s) : l;
  else {
    if (e < o) return [];
    if (l = l[e - 1], t || s) if (h)
      (l.length > t || s) && (l = l.slice(s, t + s));
    else {
      n = [];
      for (let c = 0, m; c < l.length; c++) if (m = l[c]) {
        if (s && m.length > s) s -= m.length;
        else if ((t && m.length > t || s) && (m = m.slice(s, t + s), t -= m.length, s && (s -= m.length)), n.push(m), !t) break;
      }
      l = n;
    }
  }
  return l;
}
function tt(e, i, t, s, n) {
  const r = [], h = L();
  let o;
  var l = e.length;
  let f;
  if (s) {
    for (n = l - 1; n >= 0; n--)
      if (f = (s = e[n]) && s.length) {
        for (l = 0; l < f; l++) if (o = s[l], !h[o]) {
          if (h[o] = 1, t) t--;
          else if (r.push(o), r.length === i) return r;
        }
      }
  } else for (let u = l - 1, c, m = 0; u >= 0; u--) {
    c = e[u];
    for (let d = 0; d < c.length; d++) if (f = (s = c[d]) && s.length) {
      for (let p = 0; p < f; p++) if (o = s[p], !h[o]) if (h[o] = 1, t) t--;
      else {
        let a = (d + (u < l - 1 && n || 0)) / (u + 1) | 0;
        if ((r[a] || (r[a] = [])).push(o), ++m === i) return r;
      }
    }
  }
  return r;
}
function vt(e, i, t, s, n) {
  const r = L(), h = [];
  for (let o = 0, l; o < i.length; o++) {
    l = i[o];
    for (let f = 0; f < l.length; f++) r[l[f]] = 1;
  }
  if (n) {
    for (let o = 0, l; o < e.length; o++)
      if (l = e[o], r[l]) {
        if (s) s--;
        else if (h.push(l), r[l] = 0, t && --t === 0) break;
      }
  } else for (let o = 0, l, f; o < e.result.length; o++) for (l = e.result[o], i = 0; i < l.length; i++) f = l[i], r[f] && ((h[o] || (h[o] = [])).push(f), r[f] = 0);
  return h;
}
ne.prototype.search = function(e, i, t, s) {
  t || (!i && oe(e) ? (t = e, e = "") : oe(i) && (t = i, i = 0));
  let n = [];
  var r = [];
  let h, o, l, f, u, c, m = 0, d = !0, p;
  if (t) {
    t.constructor === Array && (t = { index: t }), e = t.query || e, h = t.pluck, o = t.merge, f = t.boost, c = h || t.field || (c = t.index) && (c.index ? null : c);
    var a = this.tag && t.tag;
    l = t.suggest, d = t.resolve !== !1, u = t.cache, p = d && this.store && t.highlight;
    var g = !!p || d && this.store && t.enrich;
    i = t.limit || i;
    var b = t.offset || 0;
    if (i || (i = d ? 100 : 0), a && (!this.db || !s)) {
      a.constructor !== Array && (a = [a]);
      var y = [];
      for (let A = 0, x; A < a.length; A++) if (x = a[A], x.field && x.tag) {
        var k = x.tag;
        if (k.constructor === Array) for (var z = 0; z < k.length; z++) y.push(x.field, k[z]);
        else y.push(x.field, k);
      } else {
        k = Object.keys(x);
        for (let j = 0, D, B; j < k.length; j++) if (D = k[j], B = x[D], B.constructor === Array) for (z = 0; z < B.length; z++) y.push(D, B[z]);
        else y.push(D, B);
      }
      if (a = y, !e) {
        if (r = [], y.length) for (a = 0; a < y.length; a += 2) {
          if (this.db) {
            if (s = this.index.get(y[a]), !s) continue;
            r.push(s = s.db.tag(y[a + 1], i, b, g));
          } else s = kt.call(this, y[a], y[a + 1], i, b, g);
          n.push(d ? { field: y[a], tag: y[a + 1], result: s } : [s]);
        }
        if (r.length) {
          const A = this;
          return Promise.all(r).then(function(x) {
            for (let j = 0; j < x.length; j++) d ? n[j].result = x[j] : n[j] = x[j];
            return d ? n : new C(n.length > 1 ? be(n, 1, 0, 0, l, f) : n[0], A);
          });
        }
        return d ? n : new C(n.length > 1 ? be(n, 1, 0, 0, l, f) : n[0], this);
      }
    }
    d || h || !(c = c || this.field) || (E(c) ? h = c : (c.constructor === Array && c.length === 1 && (c = c[0]), h = c.field || c.index)), c && c.constructor !== Array && (c = [c]);
  }
  c || (c = this.field);
  let O;
  y = (this.worker || this.db) && !s && [];
  for (let A = 0, x, j, D; A < c.length; A++) {
    if (j = c[A], this.db && this.tag && !this.B[A]) continue;
    let B;
    if (E(j) || (B = j, j = B.field, e = B.query || e, i = Y(B.limit, i), b = Y(B.offset, b), l = Y(B.suggest, l), p = d && this.store && Y(B.highlight, p), g = !!p || d && this.store && Y(B.enrich, g), u = Y(B.cache, u)), s) x = s[A];
    else {
      k = B || t || {}, z = k.enrich;
      var M = this.index.get(j);
      if (a && (this.db && (k.tag = a, k.field = c, O = M.db.support_tag_search), !O && z && (k.enrich = !1), O || (k.limit = 0, k.offset = 0)), x = u ? M.searchCache(e, a && !O ? 0 : i, k) : M.search(e, a && !O ? 0 : i, k), a && !O && (k.limit = i, k.offset = b), z && (k.enrich = z), y) {
        y[A] = x;
        continue;
      }
    }
    if (D = (x = x.result || x) && x.length, a && D) {
      if (k = [], z = 0, this.db && s) {
        if (!O) for (M = c.length; M < s.length; M++) {
          let F = s[M];
          if (F && F.length) z++, k.push(F);
          else if (!l) return d ? n : new C(n, this);
        }
      } else for (let F = 0, J, R; F < a.length; F += 2) {
        if (J = this.tag.get(a[F]), !J) {
          if (l) continue;
          return d ? n : new C(n, this);
        }
        if (R = (J = J && J.get(a[F + 1])) && J.length) z++, k.push(J);
        else if (!l) return d ? n : new C(n, this);
      }
      if (z) {
        if (x = vt(x, k, i, b, d), D = x.length, !D && !l) return d ? x : new C(x, this);
        z--;
      }
    }
    if (D) r[m] = j, n.push(x), m++;
    else if (c.length === 1) return d ? n : new C(
      n,
      this
    );
  }
  if (y) {
    if (this.db && a && a.length && !O) for (g = 0; g < a.length; g += 2) {
      if (r = this.index.get(a[g]), !r) {
        if (l) continue;
        return d ? n : new C(n, this);
      }
      y.push(r.db.tag(a[g + 1], i, b, !1));
    }
    const A = this;
    return Promise.all(y).then(function(x) {
      return t && (t.resolve = d), x.length && (x = A.search(e, i, t, x)), x;
    });
  }
  if (!m) return d ? n : new C(n, this);
  if (h && (!g || !this.store)) return n = n[0], d ? n : new C(n, this);
  for (y = [], b = 0; b < r.length; b++) {
    if (a = n[b], g && a.length && typeof a[0].doc > "u" && (this.db ? y.push(a = this.index.get(this.field[0]).db.enrich(a)) : a = ee.call(this, a)), h) return d ? p ? we(e, a, this.index, h, p) : a : new C(a, this);
    n[b] = { field: r[b], result: a };
  }
  if (g && this.db && y.length) {
    const A = this;
    return Promise.all(y).then(function(x) {
      for (let j = 0; j < x.length; j++) n[j].result = x[j];
      return p && (n = we(e, n, A.index, h, p)), o ? Qe(n) : n;
    });
  }
  return p && (n = we(e, n, this.index, h, p)), o ? Qe(n) : n;
};
function Qe(e) {
  const i = [], t = L(), s = L();
  for (let n = 0, r, h, o, l, f, u, c; n < e.length; n++) {
    r = e[n], h = r.field, o = r.result;
    for (let m = 0; m < o.length; m++) f = o[m], typeof f != "object" ? f = { id: l = f } : l = f.id, (u = t[l]) ? u.push(h) : (f.field = t[l] = [h], i.push(f)), (c = f.highlight) && (u = s[l], u || (s[l] = u = {}, f.highlight = u), u[h] = c);
  }
  return i;
}
function kt(e, i, t, s, n) {
  return e = this.tag.get(e), e ? (e = e.get(i), e ? (i = e.length - s, i > 0 && ((t && i > t || s) && (e = e.slice(s, s + t)), n && (e = ee.call(this, e))), e) : []) : [];
}
function ee(e) {
  if (!this || !this.store) return e;
  if (this.db) return this.index.get(this.field[0]).db.enrich(e);
  const i = Array(e.length);
  for (let t = 0, s; t < e.length; t++) s = e[t], i[t] = { id: s, doc: this.store.get(s) };
  return i;
}
function ne(e) {
  if (!this || this.constructor !== ne) return new ne(e);
  const i = e.document || e.doc || e;
  let t, s;
  if (this.B = [], this.field = [], this.D = [], this.key = (t = i.key || i.id) && xe(t, this.D) || "id", (s = e.keystore || 0) && (this.keystore = s), this.fastupdate = !!e.fastupdate, this.reg = !this.fastupdate || e.worker || e.db ? s ? new _(s) : /* @__PURE__ */ new Set() : s ? new $(s) : /* @__PURE__ */ new Map(), this.h = (t = i.store || null) && t && t !== !0 && [], this.store = t ? s ? new $(s) : /* @__PURE__ */ new Map() : null, this.cache = (t = e.cache || null) && new X(t), e.cache = !1, this.worker = e.worker || !1, this.priority = e.priority || 4, this.index = At.call(this, e, i), this.tag = null, (t = i.tag) && (typeof t == "string" && (t = [t]), t.length)) {
    this.tag = /* @__PURE__ */ new Map(), this.A = [], this.F = [];
    for (let n = 0, r, h; n < t.length; n++) {
      if (r = t[n], h = r.field || r, !h) throw Error("The tag field from the document descriptor is undefined.");
      r.custom ? this.A[n] = r.custom : (this.A[n] = xe(h, this.D), r.filter && (typeof this.A[n] == "string" && (this.A[n] = new String(this.A[n])), this.A[n].G = r.filter)), this.F[n] = h, this.tag.set(h, /* @__PURE__ */ new Map());
    }
  }
  if (this.worker) {
    this.fastupdate = !1, e = [];
    for (const n of this.index.values()) n.then && e.push(n);
    if (e.length) {
      const n = this;
      return Promise.all(e).then(function(r) {
        let h = 0;
        for (const o of n.index.entries()) {
          const l = o[0];
          let f = o[1];
          f.then && (f = r[h], n.index.set(l, f), h++);
        }
        return n;
      });
    }
  } else e.db && (this.fastupdate = !1, this.mount(e.db));
}
w = ne.prototype;
w.mount = function(e) {
  let i = this.field;
  if (this.tag) for (let r = 0, h; r < this.F.length; r++) {
    h = this.F[r];
    var t = void 0;
    this.index.set(h, t = new G({}, this.reg)), i === this.field && (i = i.slice(0)), i.push(h), t.tag = this.tag.get(h);
  }
  t = [];
  const s = { db: e.db, type: e.type, fastupdate: e.fastupdate };
  for (let r = 0, h, o; r < i.length; r++) {
    s.field = o = i[r], h = this.index.get(o);
    const l = new e.constructor(e.id, s);
    l.id = e.id, t[r] = l.mount(h), h.document = !0, r ? h.bypass = !0 : h.store = this.store;
  }
  const n = this;
  return this.db = Promise.all(t).then(function() {
    n.db = !0;
  });
};
w.commit = async function() {
  const e = [];
  for (const i of this.index.values()) e.push(i.commit());
  await Promise.all(e), this.reg.clear();
};
w.destroy = function() {
  const e = [];
  for (const i of this.index.values()) e.push(i.destroy());
  return Promise.all(e);
};
function At(e, i) {
  const t = /* @__PURE__ */ new Map();
  let s = i.index || i.field || i;
  E(s) && (s = [s]);
  for (let r = 0, h, o; r < s.length; r++) {
    if (h = s[r], E(h) || (o = h, h = h.field), o = oe(o) ? Object.assign({}, e, o) : e, this.worker) {
      var n = void 0;
      n = (n = o.encoder) && n.encode ? n : new ue(typeof n == "string" ? Ie[n] : n || {}), n = new ie(o, n), t.set(h, n);
    }
    this.worker || t.set(h, new G(o, this.reg)), o.custom ? this.B[r] = o.custom : (this.B[r] = xe(h, this.D), o.filter && (typeof this.B[r] == "string" && (this.B[r] = new String(this.B[r])), this.B[r].G = o.filter)), this.field[r] = h;
  }
  if (this.h) {
    e = i.store, E(e) && (e = [e]);
    for (let r = 0, h, o; r < e.length; r++) h = e[r], o = h.field || h, h.custom ? (this.h[r] = h.custom, h.custom.O = o) : (this.h[r] = xe(o, this.D), h.filter && (typeof this.h[r] == "string" && (this.h[r] = new String(this.h[r])), this.h[r].G = h.filter));
  }
  return t;
}
function xe(e, i) {
  const t = e.split(":");
  let s = 0;
  for (let n = 0; n < t.length; n++) e = t[n], e[e.length - 1] === "]" && (e = e.substring(0, e.length - 2)) && (i[s] = !0), e && (t[s++] = e);
  return s < t.length && (t.length = s), s > 1 ? t : t[0];
}
w.append = function(e, i) {
  return this.add(e, i, !0);
};
w.update = function(e, i) {
  return this.remove(e).add(e, i);
};
w.remove = function(e) {
  oe(e) && (e = fe(e, this.key));
  for (var i of this.index.values()) i.remove(e, !0);
  if (this.reg.has(e)) {
    if (this.tag && !this.fastupdate) for (let t of this.tag.values()) for (let s of t) {
      i = s[0];
      const n = s[1], r = n.indexOf(e);
      r > -1 && (n.length > 1 ? n.splice(r, 1) : t.delete(i));
    }
    this.store && this.store.delete(e), this.reg.delete(e);
  }
  return this.cache && this.cache.remove(e), this;
};
w.clear = function() {
  const e = [];
  for (const i of this.index.values()) {
    const t = i.clear();
    t.then && e.push(t);
  }
  if (this.tag) for (const i of this.tag.values()) i.clear();
  return this.store && this.store.clear(), this.cache && this.cache.clear(), e.length ? Promise.all(e) : this;
};
w.contain = function(e) {
  return this.db ? this.index.get(this.field[0]).db.has(e) : this.reg.has(e);
};
w.cleanup = function() {
  for (const e of this.index.values()) e.cleanup();
  return this;
};
w.get = function(e) {
  return this.db ? this.index.get(this.field[0]).db.enrich(e).then(function(i) {
    return i[0] && i[0].doc || null;
  }) : this.store.get(e) || null;
};
w.set = function(e, i) {
  return typeof e == "object" && (i = e, e = fe(i, this.key)), this.store.set(e, i), this;
};
w.searchCache = Le;
w.export = jt;
w.import = Mt;
Fe(ne.prototype);
function Re(e, i = 0) {
  let t = [], s = [];
  i && (i = 25e4 / i * 5e3 | 0);
  for (const n of e.entries()) s.push(n), s.length === i && (t.push(s), s = []);
  return s.length && t.push(s), t;
}
function Ee(e, i) {
  i || (i = /* @__PURE__ */ new Map());
  for (let t = 0, s; t < e.length; t++) s = e[t], i.set(s[0], s[1]);
  return i;
}
function it(e, i = 0) {
  let t = [], s = [];
  i && (i = 25e4 / i * 1e3 | 0);
  for (const n of e.entries()) s.push([n[0], Re(n[1])[0] || []]), s.length === i && (t.push(s), s = []);
  return s.length && t.push(s), t;
}
function nt(e, i) {
  i || (i = /* @__PURE__ */ new Map());
  for (let t = 0, s, n; t < e.length; t++) s = e[t], n = i.get(s[0]), i.set(s[0], Ee(s[1], n));
  return i;
}
function st(e) {
  let i = [], t = [];
  for (const s of e.keys()) t.push(s), t.length === 25e4 && (i.push(t), t = []);
  return t.length && i.push(t), i;
}
function rt(e, i) {
  i || (i = /* @__PURE__ */ new Set());
  for (let t = 0; t < e.length; t++) i.add(e[t]);
  return i;
}
function ve(e, i, t, s, n, r, h = 0) {
  const o = s && s.constructor === Array;
  var l = o ? s.shift() : s;
  if (!l) return this.export(e, i, n, r + 1);
  if ((l = e((i ? i + "." : "") + (h + 1) + "." + t, JSON.stringify(l))) && l.then) {
    const f = this;
    return l.then(function() {
      return ve.call(f, e, i, t, o ? s : null, n, r, h + 1);
    });
  }
  return ve.call(this, e, i, t, o ? s : null, n, r, h + 1);
}
function jt(e, i, t = 0, s = 0) {
  if (t < this.field.length) {
    const h = this.field[t];
    if ((i = this.index.get(h).export(e, h, t, s = 1)) && i.then) {
      const o = this;
      return i.then(function() {
        return o.export(e, h, t + 1);
      });
    }
    return this.export(e, h, t + 1);
  }
  let n, r;
  switch (s) {
    case 0:
      n = "reg", r = st(this.reg), i = null;
      break;
    case 1:
      n = "tag", r = this.tag && it(this.tag, this.reg.size), i = null;
      break;
    case 2:
      n = "doc", r = this.store && Re(this.store), i = null;
      break;
    default:
      return;
  }
  return ve.call(this, e, i, n, r || null, t, s);
}
function Mt(e, i) {
  var t = e.split(".");
  t[t.length - 1] === "json" && t.pop();
  const s = t.length > 2 ? t[0] : "";
  if (t = t.length > 2 ? t[2] : t[1], this.worker && s) return this.index.get(s).import(e);
  if (i) {
    if (typeof i == "string" && (i = JSON.parse(i)), s) return this.index.get(s).import(t, i);
    switch (t) {
      case "reg":
        this.fastupdate = !1, this.reg = rt(i, this.reg);
        for (let n = 0, r; n < this.field.length; n++) r = this.index.get(this.field[n]), r.fastupdate = !1, r.reg = this.reg;
        if (this.worker) {
          i = [];
          for (const n of this.index.values()) i.push(n.import(e));
          return Promise.all(i);
        }
        break;
      case "tag":
        this.tag = nt(i, this.tag);
        break;
      case "doc":
        this.store = Ee(i, this.store);
    }
  }
}
function Ve(e, i) {
  let t = "";
  for (const s of e.entries()) {
    e = s[0];
    const n = s[1];
    let r = "";
    for (let h = 0, o; h < n.length; h++) {
      o = n[h] || [""];
      let l = "";
      for (let f = 0; f < o.length; f++) l += (l ? "," : "") + (i === "string" ? '"' + o[f] + '"' : o[f]);
      l = "[" + l + "]", r += (r ? "," : "") + l;
    }
    r = '["' + e + '",[' + r + "]]", t += (t ? "," : "") + r;
  }
  return t;
}
G.prototype.remove = function(e, i) {
  const t = this.reg.size && (this.fastupdate ? this.reg.get(e) : this.reg.has(e));
  if (t) {
    if (this.fastupdate) {
      for (let s = 0, n, r; s < t.length; s++)
        if ((n = t[s]) && (r = n.length)) if (n[r - 1] === e) n.pop();
        else {
          const h = n.indexOf(e);
          h >= 0 && n.splice(h, 1);
        }
    } else ae(this.map, e), this.depth && ae(this.ctx, e);
    i || this.reg.delete(e);
  }
  return this.db && (this.commit_task.push({ del: e }), this.M && ht(this)), this.cache && this.cache.remove(e), this;
};
function ae(e, i) {
  let t = 0;
  var s = typeof i > "u";
  if (e.constructor === Array) {
    for (let n = 0, r, h, o; n < e.length; n++)
      if ((r = e[n]) && r.length) {
        if (s) return 1;
        if (h = r.indexOf(i), h >= 0) {
          if (r.length > 1) return r.splice(h, 1), 1;
          if (delete e[n], t) return 1;
          o = 1;
        } else {
          if (o) return 1;
          t++;
        }
      }
  } else for (let n of e.entries()) s = n[0], ae(n[1], i) ? t++ : e.delete(s);
  return t;
}
const zt = { memory: { resolution: 1 }, performance: { resolution: 3, fastupdate: !0, context: { depth: 1, resolution: 1 } }, match: { tokenize: "forward" }, score: { resolution: 9, context: { depth: 2, resolution: 3 } } };
G.prototype.add = function(e, i, t, s) {
  if (i && (e || e === 0)) {
    if (!s && !t && this.reg.has(e)) return this.update(e, i);
    s = this.depth, i = this.encoder.encode(i, !s);
    const f = i.length;
    if (f) {
      const u = L(), c = L(), m = this.resolution;
      for (let d = 0; d < f; d++) {
        let p = i[this.rtl ? f - 1 - d : d];
        var n = p.length;
        if (n && (s || !c[p])) {
          var r = this.score ? this.score(i, p, d, null, 0) : me(m, f, d), h = "";
          switch (this.tokenize) {
            case "tolerant":
              if (T(this, c, p, r, e, t), n > 2) {
                for (let a = 1, g, b, y, k; a < n - 1; a++) g = p.charAt(a), b = p.charAt(a + 1), y = p.substring(0, a) + b, k = p.substring(a + 2), h = y + g + k, T(this, c, h, r, e, t), h = y + k, T(this, c, h, r, e, t);
                T(this, c, p.substring(0, p.length - 1), r, e, t);
              }
              break;
            case "full":
              if (n > 2) {
                for (let a = 0, g; a < n; a++) for (r = n; r > a; r--) {
                  h = p.substring(a, r), g = this.rtl ? n - 1 - a : a;
                  var o = this.score ? this.score(i, p, d, h, g) : me(m, f, d, n, g);
                  T(this, c, h, o, e, t);
                }
                break;
              }
            case "bidirectional":
            case "reverse":
              if (n > 1) {
                for (o = n - 1; o > 0; o--) {
                  h = p[this.rtl ? n - 1 - o : o] + h;
                  var l = this.score ? this.score(i, p, d, h, o) : me(m, f, d, n, o);
                  T(this, c, h, l, e, t);
                }
                h = "";
              }
            case "forward":
              if (n > 1) {
                for (o = 0; o < n; o++) h += p[this.rtl ? n - 1 - o : o], T(
                  this,
                  c,
                  h,
                  r,
                  e,
                  t
                );
                break;
              }
            default:
              if (T(this, c, p, r, e, t), s && f > 1 && d < f - 1) for (n = this.N, h = p, r = Math.min(s + 1, this.rtl ? d + 1 : f - d), o = 1; o < r; o++) {
                p = i[this.rtl ? f - 1 - d - o : d + o], l = this.bidirectional && p > h;
                const a = this.score ? this.score(i, h, d, p, o - 1) : me(n + (f / 2 > n ? 0 : 1), f, d, r - 1, o - 1);
                T(this, u, l ? h : p, a, e, t, l ? p : h);
              }
          }
        }
      }
      this.fastupdate || this.reg.add(e);
    }
  }
  return this.db && (this.commit_task.push(t ? { ins: e } : { del: e }), this.M && ht(this)), this;
};
function T(e, i, t, s, n, r, h) {
  let o, l;
  if (!(o = i[t]) || h && !o[h]) {
    if (h ? (i = o || (i[t] = L()), i[h] = 1, l = e.ctx, (o = l.get(h)) ? l = o : l.set(h, l = e.keystore ? new $(e.keystore) : /* @__PURE__ */ new Map())) : (l = e.map, i[t] = 1), (o = l.get(t)) ? l = o : l.set(t, l = o = []), r) {
      for (let f = 0, u; f < o.length; f++) if ((u = o[f]) && u.includes(n)) {
        if (f <= s) return;
        u.splice(u.indexOf(n), 1), e.fastupdate && (i = e.reg.get(n)) && i.splice(i.indexOf(u), 1);
        break;
      }
    }
    if (l = l[s] || (l[s] = []), l.push(n), l.length === 2 ** 31 - 1) {
      if (i = new te(l), e.fastupdate) for (let f of e.reg.values()) f.includes(l) && (f[f.indexOf(l)] = i);
      o[s] = l = i;
    }
    e.fastupdate && ((s = e.reg.get(n)) ? s.push(l) : e.reg.set(n, [l]));
  }
}
function me(e, i, t, s, n) {
  return t && e > 1 ? i + (s || 0) <= e ? t + (n || 0) : (e - 1) / (i + (s || 0)) * (t + (n || 0)) + 1 | 0 : 0;
}
G.prototype.search = function(e, i, t) {
  if (t || (i || typeof e != "object" ? typeof i == "object" && (t = i, i = 0) : (t = e, e = "")), t && t.cache) return t.cache = !1, e = this.searchCache(e, i, t), t.cache = !0, e;
  let s = [], n, r, h, o = 0, l, f, u, c, m;
  t && (e = t.query || e, i = t.limit || i, o = t.offset || 0, r = t.context, h = t.suggest, m = (l = t.resolve) && t.enrich, u = t.boost, c = t.resolution, f = this.db && t.tag), typeof l > "u" && (l = this.resolve), r = this.depth && r !== !1;
  let d = this.encoder.encode(e, !r);
  if (n = d.length, i = i || (l ? 100 : 0), n === 1) return Ye.call(
    this,
    d[0],
    "",
    i,
    o,
    l,
    m,
    f
  );
  if (n === 2 && r && !h) return Ye.call(this, d[1], d[0], i, o, l, m, f);
  let p = L(), a = 0, g;
  if (r && (g = d[0], a = 1), c || c === 0 || (c = g ? this.N : this.resolution), this.db) {
    if (this.db.search && (t = this.db.search(this, d, i, o, h, l, m, f), t !== !1)) return t;
    const b = this;
    return (async function() {
      for (let y, k; a < n; a++) {
        if ((k = d[a]) && !p[k]) {
          if (p[k] = 1, y = await De(b, k, g, 0, 0, !1, !1), y = Ke(y, s, h, c)) {
            s = y;
            break;
          }
          g && (h && y && s.length || (g = k));
        }
        h && g && a === n - 1 && !s.length && (c = b.resolution, g = "", a = -1, p = L());
      }
      return Xe(s, c, i, o, h, u, l);
    })();
  }
  for (let b, y; a < n; a++) {
    if ((y = d[a]) && !p[y]) {
      if (p[y] = 1, b = De(this, y, g, 0, 0, !1, !1), b = Ke(b, s, h, c)) {
        s = b;
        break;
      }
      g && (h && b && s.length || (g = y));
    }
    h && g && a === n - 1 && !s.length && (c = this.resolution, g = "", a = -1, p = L());
  }
  return Xe(s, c, i, o, h, u, l);
};
function Xe(e, i, t, s, n, r, h) {
  let o = e.length, l = e;
  if (o > 1) l = be(e, i, t, s, n, r, h);
  else if (o === 1) return h ? Ne.call(null, e[0], t, s) : new C(e[0], this);
  return h ? l : new C(l, this);
}
function Ye(e, i, t, s, n, r, h) {
  return e = De(this, e, i, t, s, n, r, h), this.db ? e.then(function(o) {
    return n ? o || [] : new C(o, this);
  }) : e && e.length ? n ? Ne.call(this, e, t, s) : new C(e, this) : n ? [] : new C([], this);
}
function Ke(e, i, t, s) {
  let n = [];
  if (e && e.length) {
    if (e.length <= s) {
      i.push(e);
      return;
    }
    for (let r = 0, h; r < s; r++) (h = e[r]) && (n[r] = h);
    if (n.length) {
      i.push(n);
      return;
    }
  }
  if (!t) return n;
}
function De(e, i, t, s, n, r, h, o) {
  let l;
  return t && (l = e.bidirectional && i > t) && (l = t, t = i, i = l), e.db ? e.db.get(i, t, s, n, r, h, o) : (e = t ? (e = e.ctx.get(t)) && e.get(i) : e.map.get(i), e);
}
function G(e, i) {
  if (!this || this.constructor !== G) return new G(e);
  if (e) {
    var t = E(e) ? e : e.preset;
    t && (e = Object.assign({}, zt[t], e));
  } else e = {};
  t = e.context;
  const s = t === !0 ? { depth: 1 } : t || {}, n = E(e.encoder) ? Ie[e.encoder] : e.encode || e.encoder || {};
  this.encoder = n.encode ? n : typeof n == "object" ? new ue(n) : { encode: n }, this.resolution = e.resolution || 9, this.tokenize = t = (t = e.tokenize) && t !== "default" && t !== "exact" && t || "strict", this.depth = t === "strict" && s.depth || 0, this.bidirectional = s.bidirectional !== !1, this.fastupdate = !!e.fastupdate, this.score = e.score || null, (t = e.keystore || 0) && (this.keystore = t), this.map = t ? new $(t) : /* @__PURE__ */ new Map(), this.ctx = t ? new $(t) : /* @__PURE__ */ new Map(), this.reg = i || (this.fastupdate ? t ? new $(t) : /* @__PURE__ */ new Map() : t ? new _(t) : /* @__PURE__ */ new Set()), this.N = s.resolution || 3, this.rtl = n.rtl || e.rtl || !1, this.cache = (t = e.cache || null) && new X(t), this.resolve = e.resolve !== !1, (t = e.db) && (this.db = this.mount(t)), this.M = e.commit !== !1, this.commit_task = [], this.commit_timer = null, this.priority = e.priority || 4;
}
w = G.prototype;
w.mount = function(e) {
  return this.commit_timer && (clearTimeout(this.commit_timer), this.commit_timer = null), e.mount(this);
};
w.commit = function() {
  return this.commit_timer && (clearTimeout(this.commit_timer), this.commit_timer = null), this.db.commit(this);
};
w.destroy = function() {
  return this.commit_timer && (clearTimeout(this.commit_timer), this.commit_timer = null), this.db.destroy();
};
function ht(e) {
  e.commit_timer || (e.commit_timer = setTimeout(function() {
    e.commit_timer = null, e.db.commit(e);
  }, 1));
}
w.clear = function() {
  return this.map.clear(), this.ctx.clear(), this.reg.clear(), this.cache && this.cache.clear(), this.db ? (this.commit_timer && clearTimeout(this.commit_timer), this.commit_timer = null, this.commit_task = [], this.db.clear()) : this;
};
w.append = function(e, i) {
  return this.add(e, i, !0);
};
w.contain = function(e) {
  return this.db ? this.db.has(e) : this.reg.has(e);
};
w.update = function(e, i) {
  const t = this, s = this.remove(e);
  return s && s.then ? s.then(() => t.add(e, i)) : this.add(e, i);
};
w.cleanup = function() {
  return this.fastupdate ? (ae(this.map), this.depth && ae(this.ctx), this) : this;
};
w.searchCache = Le;
w.export = function(e, i, t = 0, s = 0) {
  let n, r;
  switch (s) {
    case 0:
      n = "reg", r = st(this.reg);
      break;
    case 1:
      n = "cfg", r = null;
      break;
    case 2:
      n = "map", r = Re(this.map, this.reg.size);
      break;
    case 3:
      n = "ctx", r = it(this.ctx, this.reg.size);
      break;
    default:
      return;
  }
  return ve.call(this, e, i, n, r, t, s);
};
w.import = function(e, i) {
  if (i) switch (typeof i == "string" && (i = JSON.parse(i)), e = e.split("."), e[e.length - 1] === "json" && e.pop(), e.length === 3 && e.shift(), e = e.length > 1 ? e[1] : e[0], e) {
    case "reg":
      this.fastupdate = !1, this.reg = rt(i, this.reg);
      break;
    case "map":
      this.map = Ee(i, this.map);
      break;
    case "ctx":
      this.ctx = nt(i, this.ctx);
  }
};
w.serialize = function(e = !0) {
  let i = "", t = "", s = "";
  if (this.reg.size) {
    let r;
    for (var n of this.reg.keys()) r || (r = typeof n), i += (i ? "," : "") + (r === "string" ? '"' + n + '"' : n);
    i = "index.reg=new Set([" + i + "]);", t = Ve(this.map, r), t = "index.map=new Map([" + t + "]);";
    for (const h of this.ctx.entries()) {
      n = h[0];
      let o = Ve(h[1], r);
      o = "new Map([" + o + "])", o = '["' + n + '",' + o + "]", s += (s ? "," : "") + o;
    }
    s = "index.ctx=new Map([" + s + "]);";
  }
  return e ? "function inject(index){" + i + t + s + "}" : i + t + s;
};
Fe(G.prototype);
const lt = typeof window < "u" && (window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB), ke = ["map", "ctx", "tag", "reg", "cfg"], Q = L();
function qe(e, i = {}) {
  if (!this || this.constructor !== qe) return new qe(e, i);
  typeof e == "object" && (i = e, e = e.name), e || console.info("Default storage space was used, because a name was not passed."), this.id = "flexsearch" + (e ? ":" + e.toLowerCase().replace(/[^a-z0-9_\-]/g, "") : ""), this.field = i.field ? i.field.toLowerCase().replace(/[^a-z0-9_\-]/g, "") : "", this.type = i.type, this.fastupdate = this.support_tag_search = !1, this.db = null, this.h = {};
}
w = qe.prototype;
w.mount = function(e) {
  return e.index ? e.mount(this) : (e.db = this, this.open());
};
w.open = function() {
  if (this.db) return this.db;
  let e = this;
  navigator.storage && navigator.storage.persist && navigator.storage.persist(), Q[e.id] || (Q[e.id] = []), Q[e.id].push(e.field);
  const i = lt.open(e.id, 1);
  return i.onupgradeneeded = function() {
    const t = e.db = this.result;
    for (let s = 0, n; s < ke.length; s++) {
      n = ke[s];
      for (let r = 0, h; r < Q[e.id].length; r++) h = Q[e.id][r], t.objectStoreNames.contains(n + (n !== "reg" && h ? ":" + h : "")) || t.createObjectStore(n + (n !== "reg" && h ? ":" + h : ""));
    }
  }, e.db = S(i, function(t) {
    e.db = t, e.db.onversionchange = function() {
      e.close();
    };
  });
};
w.close = function() {
  this.db && this.db.close(), this.db = null;
};
w.destroy = function() {
  const e = lt.deleteDatabase(this.id);
  return S(e);
};
w.clear = function() {
  const e = [];
  for (let t = 0, s; t < ke.length; t++) {
    s = ke[t];
    for (let n = 0, r; n < Q[this.id].length; n++) r = Q[this.id][n], e.push(s + (s !== "reg" && r ? ":" + r : ""));
  }
  const i = this.db.transaction(e, "readwrite");
  for (let t = 0; t < e.length; t++) i.objectStore(e[t]).clear();
  return S(i);
};
w.get = function(e, i, t = 0, s = 0, n = !0, r = !1) {
  e = this.db.transaction((i ? "ctx" : "map") + (this.field ? ":" + this.field : ""), "readonly").objectStore((i ? "ctx" : "map") + (this.field ? ":" + this.field : "")).get(i ? i + ":" + e : e);
  const h = this;
  return S(e).then(function(o) {
    let l = [];
    if (!o || !o.length) return l;
    if (n) {
      if (!t && !s && o.length === 1) return o[0];
      for (let f = 0, u; f < o.length; f++) if ((u = o[f]) && u.length) {
        if (s >= u.length) {
          s -= u.length;
          continue;
        }
        const c = t ? s + Math.min(u.length - s, t) : u.length;
        for (let m = s; m < c; m++) l.push(u[m]);
        if (s = 0, l.length === t) break;
      }
      return r ? h.enrich(l) : l;
    }
    return o;
  });
};
w.tag = function(e, i = 0, t = 0, s = !1) {
  e = this.db.transaction("tag" + (this.field ? ":" + this.field : ""), "readonly").objectStore("tag" + (this.field ? ":" + this.field : "")).get(e);
  const n = this;
  return S(e).then(function(r) {
    return !r || !r.length || t >= r.length ? [] : !i && !t ? r : (r = r.slice(t, t + i), s ? n.enrich(r) : r);
  });
};
w.enrich = function(e) {
  typeof e != "object" && (e = [e]);
  const i = this.db.transaction("reg", "readonly").objectStore("reg"), t = [];
  for (let s = 0; s < e.length; s++) t[s] = S(i.get(e[s]));
  return Promise.all(t).then(function(s) {
    for (let n = 0; n < s.length; n++) s[n] = { id: e[n], doc: s[n] ? JSON.parse(s[n]) : null };
    return s;
  });
};
w.has = function(e) {
  return e = this.db.transaction("reg", "readonly").objectStore("reg").getKey(e), S(e).then(function(i) {
    return !!i;
  });
};
w.search = null;
w.info = function() {
};
w.transaction = function(e, i, t) {
  e += e !== "reg" && this.field ? ":" + this.field : "";
  let s = this.h[e + ":" + i];
  if (s) return t.call(this, s);
  let n = this.db.transaction(e, i);
  this.h[e + ":" + i] = s = n.objectStore(e);
  const r = t.call(this, s);
  return this.h[e + ":" + i] = null, S(n).finally(function() {
    return r;
  });
};
w.commit = async function(e) {
  let i = e.commit_task, t = [];
  e.commit_task = [];
  for (let s = 0, n; s < i.length; s++) n = i[s], n.del && t.push(n.del);
  t.length && await this.remove(t), e.reg.size && (await this.transaction("map", "readwrite", function(s) {
    for (const n of e.map) {
      const r = n[0], h = n[1];
      h.length && (s.get(r).onsuccess = function() {
        let o = this.result;
        var l;
        if (o && o.length) {
          const f = Math.max(o.length, h.length);
          for (let u = 0, c, m; u < f; u++) if ((m = h[u]) && m.length) {
            if ((c = o[u]) && c.length) for (l = 0; l < m.length; l++) c.push(m[l]);
            else o[u] = m;
            l = 1;
          }
        } else o = h, l = 1;
        l && s.put(o, r);
      });
    }
  }), await this.transaction("ctx", "readwrite", function(s) {
    for (const n of e.ctx) {
      const r = n[0], h = n[1];
      for (const o of h) {
        const l = o[0], f = o[1];
        f.length && (s.get(r + ":" + l).onsuccess = function() {
          let u = this.result;
          var c;
          if (u && u.length) {
            const m = Math.max(u.length, f.length);
            for (let d = 0, p, a; d < m; d++) if ((a = f[d]) && a.length) {
              if ((p = u[d]) && p.length) for (c = 0; c < a.length; c++) p.push(a[c]);
              else u[d] = a;
              c = 1;
            }
          } else u = f, c = 1;
          c && s.put(u, r + ":" + l);
        });
      }
    }
  }), e.store ? await this.transaction(
    "reg",
    "readwrite",
    function(s) {
      for (const n of e.store) {
        const r = n[0], h = n[1];
        s.put(typeof h == "object" ? JSON.stringify(h) : 1, r);
      }
    }
  ) : e.bypass || await this.transaction("reg", "readwrite", function(s) {
    for (const n of e.reg.keys()) s.put(1, n);
  }), e.tag && await this.transaction("tag", "readwrite", function(s) {
    for (const n of e.tag) {
      const r = n[0], h = n[1];
      h.length && (s.get(r).onsuccess = function() {
        let o = this.result;
        o = o && o.length ? o.concat(h) : h, s.put(o, r);
      });
    }
  }), e.map.clear(), e.ctx.clear(), e.tag && e.tag.clear(), e.store && e.store.clear(), e.document || e.reg.clear());
};
function ze(e, i, t) {
  const s = e.value;
  let n, r = 0;
  for (let h = 0, o; h < s.length; h++) {
    if (o = t ? s : s[h]) {
      for (let l = 0, f, u; l < i.length; l++) if (u = i[l], f = o.indexOf(u), f >= 0) if (n = 1, o.length > 1) o.splice(f, 1);
      else {
        s[h] = [];
        break;
      }
      r += o.length;
    }
    if (t) break;
  }
  r ? n && e.update(s) : e.delete(), e.continue();
}
w.remove = function(e) {
  return typeof e != "object" && (e = [e]), Promise.all([this.transaction("map", "readwrite", function(i) {
    i.openCursor().onsuccess = function() {
      const t = this.result;
      t && ze(t, e);
    };
  }), this.transaction("ctx", "readwrite", function(i) {
    i.openCursor().onsuccess = function() {
      const t = this.result;
      t && ze(t, e);
    };
  }), this.transaction("tag", "readwrite", function(i) {
    i.openCursor().onsuccess = function() {
      const t = this.result;
      t && ze(t, e, !0);
    };
  }), this.transaction("reg", "readwrite", function(i) {
    for (let t = 0; t < e.length; t++) i.delete(e[t]);
  })]);
};
function S(e, i) {
  return new Promise((t, s) => {
    e.onsuccess = e.oncomplete = function() {
      i && i(this.result), i = null, t(this.result);
    }, e.onerror = e.onblocked = s, e = null;
  });
}
const ot = G, Ot = Ie, ft = {
  tokenize: "forward",
  encoder: Ot.LatinBalance
};
let le = new ot(ft);
self.onmessage = (e) => {
  switch (e.data.type) {
    case "clear":
      le.clear(), le.cleanup(), le = new ot(ft), postMessage({ identifier: e.data.identifier });
      break;
    case "points":
      for (let t of e.data.points)
        le.add(t.id, t.text);
      postMessage({ identifier: e.data.identifier });
      break;
    case "query":
      let i = le.search(e.data.query, { limit: e.data.limit });
      postMessage({ identifier: e.data.identifier, result: i });
      break;
  }
};
var Bt = /* @__PURE__ */ Object.freeze({
  __proto__: null
});
