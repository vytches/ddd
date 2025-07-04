import { EVENT_HANDLER_METADATA as ue, EVENT_HANDLER_OPTIONS as fe, IEventBus as Fe, isEventHandler as de } from "@vytches-ddd/contracts";
import { Logger as Ve } from "@vytches-ddd/logging";
import { LibUtils as V } from "@vytches-ddd/utils";
class We {
  constructor() {
    this.buses = /* @__PURE__ */ new Map();
  }
  /**
   * Register an event bus with a specific type name
   */
  register(r, i) {
    this.buses.set(r, i);
  }
  /**
   * Get a registered event bus by type
   */
  get(r) {
    return this.buses.get(r);
  }
  /**
   * Check if a specific bus type is registered
   */
  has(r) {
    return this.buses.has(r);
  }
}
class Xe {
  /**
   * Create a new universal event dispatcher
   */
  constructor() {
    this.middlewares = [], this.processors = [], this.registry = new We();
  }
  /**
   * Register an additional event bus
   */
  registerEventBus(r, i) {
    return this.registry.register(r, i), this;
  }
  /**
   * Register an event processor
   */
  registerProcessor(r) {
    return this.processors.push(r), this;
  }
  /**
   * Add middleware to the event pipeline
   */
  use(r) {
    return this.middlewares.push(r), this;
  }
  /**
   * Get the event bus registry
   */
  getRegistry() {
    return this.registry;
  }
  /**
   * Dispatch all events from an aggregate and clear them
   */
  async dispatchEventsForAggregate(r) {
    const i = r.getDomainEvents();
    i.length !== 0 && (await this.dispatchEvents(...i), r.commit());
  }
  /**
   * Dispatch a single event
   */
  async dispatchEvent(r) {
    await this.buildPipeline()(r), await this.processEvent(r);
  }
  /**
   * Dispatch multiple events
   */
  async dispatchEvents(...r) {
    for (const i of r)
      await this.dispatchEvent(i);
  }
  /**
   * Process an event through all registered processors
   */
  async processEvent(r) {
    for (const i of this.processors)
      await i.process(r, this.registry);
  }
  /**
   * Build the middleware pipeline for event processing
   */
  buildPipeline() {
    let r = async (i) => {
      const a = this.registry.get("domain");
      a && await a.publish(i);
    };
    for (let i = this.middlewares.length - 1; i >= 0; i--) {
      const a = this.middlewares[i], d = r;
      r = async (g) => {
        await a(g, d);
      };
    }
    return r;
  }
}
var le = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {}, ce = {};
/*! *****************************************************************************
Copyright (C) Microsoft. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */
var he;
function ze() {
  if (he) return ce;
  he = 1;
  var O;
  return function(r) {
    (function(i) {
      var a = typeof globalThis == "object" ? globalThis : typeof le == "object" ? le : typeof self == "object" ? self : typeof this == "object" ? this : E(), d = g(r);
      typeof a.Reflect < "u" && (d = g(a.Reflect, d)), i(d, a), typeof a.Reflect > "u" && (a.Reflect = r);
      function g(R, P) {
        return function(S, D) {
          Object.defineProperty(R, S, { configurable: !0, writable: !0, value: D }), P && P(S, D);
        };
      }
      function T() {
        try {
          return Function("return this;")();
        } catch {
        }
      }
      function M() {
        try {
          return (0, eval)("(function() { return this; })()");
        } catch {
        }
      }
      function E() {
        return T() || M();
      }
    })(function(i, a) {
      var d = Object.prototype.hasOwnProperty, g = typeof Symbol == "function", T = g && typeof Symbol.toPrimitive < "u" ? Symbol.toPrimitive : "@@toPrimitive", M = g && typeof Symbol.iterator < "u" ? Symbol.iterator : "@@iterator", E = typeof Object.create == "function", R = { __proto__: [] } instanceof Array, P = !E && !R, S = {
        // create an object in dictionary mode (a.k.a. "slow" mode in v8)
        create: E ? function() {
          return F(/* @__PURE__ */ Object.create(null));
        } : R ? function() {
          return F({ __proto__: null });
        } : function() {
          return F({});
        },
        has: P ? function(e, t) {
          return d.call(e, t);
        } : function(e, t) {
          return t in e;
        },
        get: P ? function(e, t) {
          return d.call(e, t) ? e[t] : void 0;
        } : function(e, t) {
          return e[t];
        }
      }, D = Object.getPrototypeOf(Function), N = typeof Map == "function" && typeof Map.prototype.entries == "function" ? Map : $e(), $ = typeof Set == "function" && typeof Set.prototype.entries == "function" ? Set : Be(), B = typeof WeakMap == "function" ? WeakMap : He(), x = g ? Symbol.for("@reflect-metadata:registry") : void 0, A = je(), W = Ae(A);
      function ge(e, t, n, s) {
        if (h(n)) {
          if (!ee(e))
            throw new TypeError();
          if (!te(t))
            throw new TypeError();
          return Ie(e, t);
        } else {
          if (!ee(e))
            throw new TypeError();
          if (!b(t))
            throw new TypeError();
          if (!b(s) && !h(s) && !C(s))
            throw new TypeError();
          return C(s) && (s = void 0), n = k(n), ke(e, t, n, s);
        }
      }
      i("decorate", ge);
      function we(e, t) {
        function n(s, c) {
          if (!b(s))
            throw new TypeError();
          if (!h(c) && !De(c))
            throw new TypeError();
          Z(e, t, s, c);
        }
        return n;
      }
      i("metadata", we);
      function me(e, t, n, s) {
        if (!b(n))
          throw new TypeError();
        return h(s) || (s = k(s)), Z(e, t, n, s);
      }
      i("defineMetadata", me);
      function be(e, t, n) {
        if (!b(t))
          throw new TypeError();
        return h(n) || (n = k(n)), z(e, t, n);
      }
      i("hasMetadata", be);
      function _e(e, t, n) {
        if (!b(t))
          throw new TypeError();
        return h(n) || (n = k(n)), H(e, t, n);
      }
      i("hasOwnMetadata", _e);
      function Me(e, t, n) {
        if (!b(t))
          throw new TypeError();
        return h(n) || (n = k(n)), q(e, t, n);
      }
      i("getMetadata", Me);
      function Ee(e, t, n) {
        if (!b(t))
          throw new TypeError();
        return h(n) || (n = k(n)), J(e, t, n);
      }
      i("getOwnMetadata", Ee);
      function Oe(e, t) {
        if (!b(e))
          throw new TypeError();
        return h(t) || (t = k(t)), Y(e, t);
      }
      i("getMetadataKeys", Oe);
      function Te(e, t) {
        if (!b(e))
          throw new TypeError();
        return h(t) || (t = k(t)), Q(e, t);
      }
      i("getOwnMetadataKeys", Te);
      function Pe(e, t, n) {
        if (!b(t))
          throw new TypeError();
        if (h(n) || (n = k(n)), !b(t))
          throw new TypeError();
        h(n) || (n = k(n));
        var s = j(
          t,
          n,
          /*Create*/
          !1
        );
        return h(s) ? !1 : s.OrdinaryDeleteMetadata(e, t, n);
      }
      i("deleteMetadata", Pe);
      function Ie(e, t) {
        for (var n = e.length - 1; n >= 0; --n) {
          var s = e[n], c = s(t);
          if (!h(c) && !C(c)) {
            if (!te(c))
              throw new TypeError();
            t = c;
          }
        }
        return t;
      }
      function ke(e, t, n, s) {
        for (var c = e.length - 1; c >= 0; --c) {
          var w = e[c], _ = w(t, n, s);
          if (!h(_) && !C(_)) {
            if (!b(_))
              throw new TypeError();
            s = _;
          }
        }
        return s;
      }
      function z(e, t, n) {
        var s = H(e, t, n);
        if (s)
          return !0;
        var c = L(t);
        return C(c) ? !1 : z(e, c, n);
      }
      function H(e, t, n) {
        var s = j(
          t,
          n,
          /*Create*/
          !1
        );
        return h(s) ? !1 : K(s.OrdinaryHasOwnMetadata(e, t, n));
      }
      function q(e, t, n) {
        var s = H(e, t, n);
        if (s)
          return J(e, t, n);
        var c = L(t);
        if (!C(c))
          return q(e, c, n);
      }
      function J(e, t, n) {
        var s = j(
          t,
          n,
          /*Create*/
          !1
        );
        if (!h(s))
          return s.OrdinaryGetOwnMetadata(e, t, n);
      }
      function Z(e, t, n, s) {
        var c = j(
          n,
          s,
          /*Create*/
          !0
        );
        c.OrdinaryDefineOwnMetadata(e, t, n, s);
      }
      function Y(e, t) {
        var n = Q(e, t), s = L(e);
        if (s === null)
          return n;
        var c = Y(s, t);
        if (c.length <= 0)
          return n;
        if (n.length <= 0)
          return c;
        for (var w = new $(), _ = [], p = 0, o = n; p < o.length; p++) {
          var u = o[p], f = w.has(u);
          f || (w.add(u), _.push(u));
        }
        for (var l = 0, v = c; l < v.length; l++) {
          var u = v[l], f = w.has(u);
          f || (w.add(u), _.push(u));
        }
        return _;
      }
      function Q(e, t) {
        var n = j(
          e,
          t,
          /*create*/
          !1
        );
        return n ? n.OrdinaryOwnMetadataKeys(e, t) : [];
      }
      function X(e) {
        if (e === null)
          return 1;
        switch (typeof e) {
          case "undefined":
            return 0;
          case "boolean":
            return 2;
          case "string":
            return 3;
          case "symbol":
            return 4;
          case "number":
            return 5;
          case "object":
            return e === null ? 1 : 6;
          default:
            return 6;
        }
      }
      function h(e) {
        return e === void 0;
      }
      function C(e) {
        return e === null;
      }
      function Re(e) {
        return typeof e == "symbol";
      }
      function b(e) {
        return typeof e == "object" ? e !== null : typeof e == "function";
      }
      function Se(e, t) {
        switch (X(e)) {
          case 0:
            return e;
          case 1:
            return e;
          case 2:
            return e;
          case 3:
            return e;
          case 4:
            return e;
          case 5:
            return e;
        }
        var n = "string", s = re(e, T);
        if (s !== void 0) {
          var c = s.call(e, n);
          if (b(c))
            throw new TypeError();
          return c;
        }
        return xe(e);
      }
      function xe(e, t) {
        var n, s, c;
        {
          var w = e.toString;
          if (U(w)) {
            var s = w.call(e);
            if (!b(s))
              return s;
          }
          var n = e.valueOf;
          if (U(n)) {
            var s = n.call(e);
            if (!b(s))
              return s;
          }
        }
        throw new TypeError();
      }
      function K(e) {
        return !!e;
      }
      function Ce(e) {
        return "" + e;
      }
      function k(e) {
        var t = Se(e);
        return Re(t) ? t : Ce(t);
      }
      function ee(e) {
        return Array.isArray ? Array.isArray(e) : e instanceof Object ? e instanceof Array : Object.prototype.toString.call(e) === "[object Array]";
      }
      function U(e) {
        return typeof e == "function";
      }
      function te(e) {
        return typeof e == "function";
      }
      function De(e) {
        switch (X(e)) {
          case 3:
            return !0;
          case 4:
            return !0;
          default:
            return !1;
        }
      }
      function G(e, t) {
        return e === t || e !== e && t !== t;
      }
      function re(e, t) {
        var n = e[t];
        if (n != null) {
          if (!U(n))
            throw new TypeError();
          return n;
        }
      }
      function ne(e) {
        var t = re(e, M);
        if (!U(t))
          throw new TypeError();
        var n = t.call(e);
        if (!b(n))
          throw new TypeError();
        return n;
      }
      function ie(e) {
        return e.value;
      }
      function ae(e) {
        var t = e.next();
        return t.done ? !1 : t;
      }
      function se(e) {
        var t = e.return;
        t && t.call(e);
      }
      function L(e) {
        var t = Object.getPrototypeOf(e);
        if (typeof e != "function" || e === D || t !== D)
          return t;
        var n = e.prototype, s = n && Object.getPrototypeOf(n);
        if (s == null || s === Object.prototype)
          return t;
        var c = s.constructor;
        return typeof c != "function" || c === e ? t : c;
      }
      function Ne() {
        var e;
        !h(x) && typeof a.Reflect < "u" && !(x in a.Reflect) && typeof a.Reflect.defineMetadata == "function" && (e = Ue(a.Reflect));
        var t, n, s, c = new B(), w = {
          registerProvider: _,
          getProvider: o,
          setProvider: f
        };
        return w;
        function _(l) {
          if (!Object.isExtensible(w))
            throw new Error("Cannot add provider to a frozen registry.");
          switch (!0) {
            case e === l:
              break;
            case h(t):
              t = l;
              break;
            case t === l:
              break;
            case h(n):
              n = l;
              break;
            case n === l:
              break;
            default:
              s === void 0 && (s = new $()), s.add(l);
              break;
          }
        }
        function p(l, v) {
          if (!h(t)) {
            if (t.isProviderFor(l, v))
              return t;
            if (!h(n)) {
              if (n.isProviderFor(l, v))
                return t;
              if (!h(s))
                for (var y = ne(s); ; ) {
                  var m = ae(y);
                  if (!m)
                    return;
                  var I = ie(m);
                  if (I.isProviderFor(l, v))
                    return se(y), I;
                }
            }
          }
          if (!h(e) && e.isProviderFor(l, v))
            return e;
        }
        function o(l, v) {
          var y = c.get(l), m;
          return h(y) || (m = y.get(v)), h(m) && (m = p(l, v), h(m) || (h(y) && (y = new N(), c.set(l, y)), y.set(v, m))), m;
        }
        function u(l) {
          if (h(l))
            throw new TypeError();
          return t === l || n === l || !h(s) && s.has(l);
        }
        function f(l, v, y) {
          if (!u(y))
            throw new Error("Metadata provider not registered.");
          var m = o(l, v);
          if (m !== y) {
            if (!h(m))
              return !1;
            var I = c.get(l);
            h(I) && (I = new N(), c.set(l, I)), I.set(v, y);
          }
          return !0;
        }
      }
      function je() {
        var e;
        return !h(x) && b(a.Reflect) && Object.isExtensible(a.Reflect) && (e = a.Reflect[x]), h(e) && (e = Ne()), !h(x) && b(a.Reflect) && Object.isExtensible(a.Reflect) && Object.defineProperty(a.Reflect, x, {
          enumerable: !1,
          configurable: !1,
          writable: !1,
          value: e
        }), e;
      }
      function Ae(e) {
        var t = new B(), n = {
          isProviderFor: function(u, f) {
            var l = t.get(u);
            return h(l) ? !1 : l.has(f);
          },
          OrdinaryDefineOwnMetadata: _,
          OrdinaryHasOwnMetadata: c,
          OrdinaryGetOwnMetadata: w,
          OrdinaryOwnMetadataKeys: p,
          OrdinaryDeleteMetadata: o
        };
        return A.registerProvider(n), n;
        function s(u, f, l) {
          var v = t.get(u), y = !1;
          if (h(v)) {
            if (!l)
              return;
            v = new N(), t.set(u, v), y = !0;
          }
          var m = v.get(f);
          if (h(m)) {
            if (!l)
              return;
            if (m = new N(), v.set(f, m), !e.setProvider(u, f, n))
              throw v.delete(f), y && t.delete(u), new Error("Wrong provider for target.");
          }
          return m;
        }
        function c(u, f, l) {
          var v = s(
            f,
            l,
            /*Create*/
            !1
          );
          return h(v) ? !1 : K(v.has(u));
        }
        function w(u, f, l) {
          var v = s(
            f,
            l,
            /*Create*/
            !1
          );
          if (!h(v))
            return v.get(u);
        }
        function _(u, f, l, v) {
          var y = s(
            l,
            v,
            /*Create*/
            !0
          );
          y.set(u, f);
        }
        function p(u, f) {
          var l = [], v = s(
            u,
            f,
            /*Create*/
            !1
          );
          if (h(v))
            return l;
          for (var y = v.keys(), m = ne(y), I = 0; ; ) {
            var oe = ae(m);
            if (!oe)
              return l.length = I, l;
            var Ge = ie(oe);
            try {
              l[I] = Ge;
            } catch (Le) {
              try {
                se(m);
              } finally {
                throw Le;
              }
            }
            I++;
          }
        }
        function o(u, f, l) {
          var v = s(
            f,
            l,
            /*Create*/
            !1
          );
          if (h(v) || !v.delete(u))
            return !1;
          if (v.size === 0) {
            var y = t.get(f);
            h(y) || (y.delete(l), y.size === 0 && t.delete(y));
          }
          return !0;
        }
      }
      function Ue(e) {
        var t = e.defineMetadata, n = e.hasOwnMetadata, s = e.getOwnMetadata, c = e.getOwnMetadataKeys, w = e.deleteMetadata, _ = new B(), p = {
          isProviderFor: function(o, u) {
            var f = _.get(o);
            return !h(f) && f.has(u) ? !0 : c(o, u).length ? (h(f) && (f = new $(), _.set(o, f)), f.add(u), !0) : !1;
          },
          OrdinaryDefineOwnMetadata: t,
          OrdinaryHasOwnMetadata: n,
          OrdinaryGetOwnMetadata: s,
          OrdinaryOwnMetadataKeys: c,
          OrdinaryDeleteMetadata: w
        };
        return p;
      }
      function j(e, t, n) {
        var s = A.getProvider(e, t);
        if (!h(s))
          return s;
        if (n) {
          if (A.setProvider(e, t, W))
            return W;
          throw new Error("Illegal state.");
        }
      }
      function $e() {
        var e = {}, t = [], n = (
          /** @class */
          function() {
            function p(o, u, f) {
              this._index = 0, this._keys = o, this._values = u, this._selector = f;
            }
            return p.prototype["@@iterator"] = function() {
              return this;
            }, p.prototype[M] = function() {
              return this;
            }, p.prototype.next = function() {
              var o = this._index;
              if (o >= 0 && o < this._keys.length) {
                var u = this._selector(this._keys[o], this._values[o]);
                return o + 1 >= this._keys.length ? (this._index = -1, this._keys = t, this._values = t) : this._index++, { value: u, done: !1 };
              }
              return { value: void 0, done: !0 };
            }, p.prototype.throw = function(o) {
              throw this._index >= 0 && (this._index = -1, this._keys = t, this._values = t), o;
            }, p.prototype.return = function(o) {
              return this._index >= 0 && (this._index = -1, this._keys = t, this._values = t), { value: o, done: !0 };
            }, p;
          }()
        ), s = (
          /** @class */
          function() {
            function p() {
              this._keys = [], this._values = [], this._cacheKey = e, this._cacheIndex = -2;
            }
            return Object.defineProperty(p.prototype, "size", {
              get: function() {
                return this._keys.length;
              },
              enumerable: !0,
              configurable: !0
            }), p.prototype.has = function(o) {
              return this._find(
                o,
                /*insert*/
                !1
              ) >= 0;
            }, p.prototype.get = function(o) {
              var u = this._find(
                o,
                /*insert*/
                !1
              );
              return u >= 0 ? this._values[u] : void 0;
            }, p.prototype.set = function(o, u) {
              var f = this._find(
                o,
                /*insert*/
                !0
              );
              return this._values[f] = u, this;
            }, p.prototype.delete = function(o) {
              var u = this._find(
                o,
                /*insert*/
                !1
              );
              if (u >= 0) {
                for (var f = this._keys.length, l = u + 1; l < f; l++)
                  this._keys[l - 1] = this._keys[l], this._values[l - 1] = this._values[l];
                return this._keys.length--, this._values.length--, G(o, this._cacheKey) && (this._cacheKey = e, this._cacheIndex = -2), !0;
              }
              return !1;
            }, p.prototype.clear = function() {
              this._keys.length = 0, this._values.length = 0, this._cacheKey = e, this._cacheIndex = -2;
            }, p.prototype.keys = function() {
              return new n(this._keys, this._values, c);
            }, p.prototype.values = function() {
              return new n(this._keys, this._values, w);
            }, p.prototype.entries = function() {
              return new n(this._keys, this._values, _);
            }, p.prototype["@@iterator"] = function() {
              return this.entries();
            }, p.prototype[M] = function() {
              return this.entries();
            }, p.prototype._find = function(o, u) {
              if (!G(this._cacheKey, o)) {
                this._cacheIndex = -1;
                for (var f = 0; f < this._keys.length; f++)
                  if (G(this._keys[f], o)) {
                    this._cacheIndex = f;
                    break;
                  }
              }
              return this._cacheIndex < 0 && u && (this._cacheIndex = this._keys.length, this._keys.push(o), this._values.push(void 0)), this._cacheIndex;
            }, p;
          }()
        );
        return s;
        function c(p, o) {
          return p;
        }
        function w(p, o) {
          return o;
        }
        function _(p, o) {
          return [p, o];
        }
      }
      function Be() {
        var e = (
          /** @class */
          function() {
            function t() {
              this._map = new N();
            }
            return Object.defineProperty(t.prototype, "size", {
              get: function() {
                return this._map.size;
              },
              enumerable: !0,
              configurable: !0
            }), t.prototype.has = function(n) {
              return this._map.has(n);
            }, t.prototype.add = function(n) {
              return this._map.set(n, n), this;
            }, t.prototype.delete = function(n) {
              return this._map.delete(n);
            }, t.prototype.clear = function() {
              this._map.clear();
            }, t.prototype.keys = function() {
              return this._map.keys();
            }, t.prototype.values = function() {
              return this._map.keys();
            }, t.prototype.entries = function() {
              return this._map.entries();
            }, t.prototype["@@iterator"] = function() {
              return this.keys();
            }, t.prototype[M] = function() {
              return this.keys();
            }, t;
          }()
        );
        return e;
      }
      function He() {
        var e = 16, t = S.create(), n = s();
        return (
          /** @class */
          function() {
            function o() {
              this._key = s();
            }
            return o.prototype.has = function(u) {
              var f = c(
                u,
                /*create*/
                !1
              );
              return f !== void 0 ? S.has(f, this._key) : !1;
            }, o.prototype.get = function(u) {
              var f = c(
                u,
                /*create*/
                !1
              );
              return f !== void 0 ? S.get(f, this._key) : void 0;
            }, o.prototype.set = function(u, f) {
              var l = c(
                u,
                /*create*/
                !0
              );
              return l[this._key] = f, this;
            }, o.prototype.delete = function(u) {
              var f = c(
                u,
                /*create*/
                !1
              );
              return f !== void 0 ? delete f[this._key] : !1;
            }, o.prototype.clear = function() {
              this._key = s();
            }, o;
          }()
        );
        function s() {
          var o;
          do
            o = "@@WeakMap@@" + p();
          while (S.has(t, o));
          return t[o] = !0, o;
        }
        function c(o, u) {
          if (!d.call(o, n)) {
            if (!u)
              return;
            Object.defineProperty(o, n, { value: S.create() });
          }
          return o[n];
        }
        function w(o, u) {
          for (var f = 0; f < u; ++f)
            o[f] = Math.random() * 255 | 0;
          return o;
        }
        function _(o) {
          if (typeof Uint8Array == "function") {
            var u = new Uint8Array(o);
            return typeof crypto < "u" ? crypto.getRandomValues(u) : typeof msCrypto < "u" ? msCrypto.getRandomValues(u) : w(u, o), u;
          }
          return w(new Array(o), o);
        }
        function p() {
          var o = _(e);
          o[6] = o[6] & 79 | 64, o[8] = o[8] & 191 | 128;
          for (var u = "", f = 0; f < e; ++f) {
            var l = o[f];
            (f === 4 || f === 6 || f === 8) && (u += "-"), l < 16 && (u += "0"), u += l.toString(16).toLowerCase();
          }
          return u;
        }
      }
      function F(e) {
        return e.__ = void 0, delete e.__, e;
      }
    });
  }(O || (O = {})), ce;
}
ze();
function Ke(O, r = {}) {
  return function(i, a, d) {
    const g = { eventType: O };
    return a !== void 0 && d !== void 0 ? (Reflect.defineMetadata(ue, g, d.value), Reflect.defineMetadata(fe, r, d.value), d) : (Reflect.defineMetadata(ue, g, i), Reflect.defineMetadata(fe, r, i), i.prototype.getEventType || (i.prototype.getEventType = function() {
      return O;
    }), i);
  };
}
const qe = Symbol("CUSTOM_MIDDLEWARE");
class pe extends Fe {
  /**
   * Creates a new event bus with the specified options
   */
  constructor(r = {}) {
    super(), this.handlers = /* @__PURE__ */ new Map(), this.logger = Ve.create("EventBus"), this.options = {
      enableLogging: !1,
      logger: (i) => this.logger.info(i),
      ...r
    }, this.publishPipeline = this.buildPublishPipeline();
  }
  async publish(r) {
    await this.publishPipeline(r);
  }
  async publishMany(r) {
    if (r.length === 0) {
      this.logger.debug("publishMany called with empty events array");
      return;
    }
    this.logger.info(`Publishing ${r.length} events`);
    const i = r.map((a) => this.publish(a));
    try {
      await Promise.all(i), this.logger.info(`Successfully published ${r.length} events`);
    } catch (a) {
      throw this.handleError(a, "publishMany"), a;
    }
  }
  // Dodanie metody use w klasie bazowej
  use(r) {
    return Object.defineProperty(r, qe, {
      value: !0
    }), this.options.middlewares = [...this.options.middlewares || [], r], this.publishPipeline = this.buildPublishPipeline(), this;
  }
  // Implementacja buildPublishPipeline w klasie bazowej
  buildPublishPipeline() {
    let i = async (a) => {
      const d = this.getEventTypeName(a), g = this.handlers.get(d);
      if (!g || g.size === 0) {
        this.logger.debug(`No handlers for ${d}`);
        return;
      }
      this.logger.debug(`Publishing ${d} to ${g.size} handlers`);
      const T = [];
      for (const M of g)
        try {
          let E;
          de(M) ? E = M.handle(a) : E = M(a), E instanceof Promise && T.push(E);
        } catch (E) {
          this.handleError(E, d);
        }
      if (T.length > 0)
        try {
          await Promise.all(T);
        } catch (M) {
          this.handleError(M, d);
        }
    };
    if (this.options.middlewares && this.options.middlewares.length > 0)
      for (let a = this.options.middlewares.length - 1; a >= 0; a--)
        i = this.options.middlewares[a](i);
    return i;
  }
  /**
   * Subscribe a function to handle events of a specific type
   */
  subscribe(r, i) {
    const a = this.getEventName(r);
    this.handlers.has(a) || this.handlers.set(a, /* @__PURE__ */ new Set()), this.handlers.get(a).add(i), this.logger.debug(`Subscribed function handler to ${a}`);
  }
  /**
   * Register a class-based handler for events of a specific type
   */
  registerHandler(r, i) {
    const a = this.getEventName(r);
    this.handlers.has(a) || this.handlers.set(a, /* @__PURE__ */ new Set()), this.handlers.get(a).add(i), this.logger.debug(`Registered class handler to ${a}`);
  }
  /**
   * Unsubscribe a handler from events of a specific type
   */
  unsubscribe(r, i) {
    const a = this.getEventName(r), d = this.handlers.get(a);
    d && (d.delete(i), d.size === 0 && this.handlers.delete(a), this.logger.debug(`Unsubscribed handler from ${a}`));
  }
  /**
   * Logs a message if logging is enabled
   */
  log(r) {
    this.options.enableLogging && this.options.logger && this.options.logger(`[EventBus] ${r}`);
  }
  /**
   * Handles errors during event processing
   */
  handleError(r, i) {
    if (this.options.onError)
      this.options.onError(r, i);
    else
      throw this.logger.error(`Error processing ${i}`, r), r;
  }
  /**
   * Extracts the event name from a constructor or string
   */
  getEventName(r) {
    if (typeof r == "string")
      return r;
    const i = r.prototype;
    return i && "eventType" in i ? i.eventType : r.name;
  }
  /**
   * Extracts the event type name from an event object
   */
  getEventTypeName(r) {
    return "eventType" in r ? r.eventType : r.constructor.name;
  }
  /**
   * Gets the registered handlers for a specific event type
   * Useful for testing and debugging
   */
  getHandlers(r) {
    const i = this.getEventName(r);
    return this.handlers.get(i);
  }
  /**
   * Gets all registered event types
   * Useful for inspection and debugging
   */
  getRegisteredEventTypes() {
    return Array.from(this.handlers.keys());
  }
  /**
   * Clears all registered handlers
   * Useful for testing
   */
  clearHandlers() {
    this.handlers.clear();
  }
}
class ve {
  /**
   * Creates a new domain event
   *
   * @param payload - The event data
   * @param metadata - Optional metadata for the event
   */
  constructor(r, i) {
    this.eventId = ve.generateId(), this.occurredOn = /* @__PURE__ */ new Date(), this.eventType = this.constructor.name, this.payload = r, this.metadata = {
      timestamp: this.occurredOn,
      ...i || {}
    };
  }
  /**
   * Generate a unique identifier for the event
   * This is a simple implementation that can be replaced in production
   */
  static generateId() {
    return V.getUUID();
  }
  /**
   * Create a copy of this event with additional metadata
   *
   * @param metadata - Metadata to merge with existing metadata
   * @returns A new event instance with combined metadata
   */
  withMetadata(r) {
    const i = this.constructor;
    return new i(this.payload, {
      ...this.metadata,
      ...r
    });
  }
}
class et extends pe {
  /**
   * Creates a new in-memory event bus
   */
  constructor(r = {}) {
    super(r);
  }
  log(r) {
    this.options.enableLogging && this.options.logger && this.options.logger(`[DomainEventBus] ${r}`);
  }
}
class ye {
  /**
   * Creates a new integration event
   *
   * @param payload - The event data
   * @param metadata - Optional metadata for the event
   */
  constructor(r, i) {
    this.eventId = ye.generateId(), this.timestamp = /* @__PURE__ */ new Date(), this.eventType = this.constructor.name, this.payload = r, this.metadata = {
      eventId: this.eventId,
      timestamp: this.timestamp,
      schemaVersion: 1,
      // Default schema version
      ...i || {}
    };
  }
  /**
   * Generates a unique identifier for the event
   * This is a simple implementation that can be replaced in production
   */
  static generateId() {
    return V.getUUID();
  }
  /**
   * Creates a copy of this event with additional metadata
   *
   * @param metadata - Metadata to merge with existing metadata
   * @returns A new event instance with combined metadata
   */
  withMetadata(r) {
    const i = this.constructor;
    return new i(this.payload, {
      ...this.metadata,
      ...r
    });
  }
  /**
   * Serializes the event to JSON format
   * @returns Serialized event as JSON string
   */
  serialize() {
    return JSON.stringify({
      eventType: this.eventType,
      payload: this.payload,
      metadata: this.metadata
    });
  }
  /**
   * Deserializes a JSON string to an event instance
   * @param EventClass Event class to instantiate
   * @param jsonString JSON string to deserialize
   * @returns Instance of the event class
   */
  static deserialize(r, i) {
    const a = JSON.parse(i);
    return new r(a.payload, a.metadata);
  }
}
class tt extends pe {
  /**
   * Creates a new in-memory integration event bus
   */
  constructor(r = {}) {
    super(r), this.handlerContexts = /* @__PURE__ */ new Map();
  }
  subscribe(r, i, a) {
    super.subscribe(r, i), a && this.handlerContexts.set(i, a);
  }
  // Również nadpisujemy registerHandler dla zachowania spójności
  registerHandler(r, i, a) {
    super.registerHandler(r, i), a && this.handlerContexts.set(i, a);
    const d = this.getEventName(r);
    this.log(
      `Registered class handler to ${d}${a ? ` for context: ${a}` : ""}`
    );
  }
  buildPublishPipeline() {
    let i = async (a) => {
      const d = this.getEventTypeName(a), g = this.handlers.get(d);
      if (!g || g.size === 0) {
        this.log(`No handlers for ${d}`);
        return;
      }
      const T = a.metadata?.targetContext, M = [];
      for (const E of g) {
        const R = this.handlerContexts.get(E);
        if (!T || !R || T === R)
          try {
            let P;
            de(E) ? P = E.handle(a) : P = E(a), P instanceof Promise && M.push(P);
          } catch (P) {
            this.handleError(P, d);
          }
      }
      M.length > 0 && await Promise.all(M);
    };
    if (this.options.middlewares)
      for (let a = this.options.middlewares.length - 1; a >= 0; a--)
        i = this.options.middlewares[a](i);
    return i;
  }
  /**
   * Dostosowanie komunikatów logowania dla eventów integracyjnych (opcjonalnie)
   */
  log(r) {
    this.options.enableLogging && this.options.logger && this.options.logger(`[IntegrationEventBus] ${r}`);
  }
}
class rt {
  constructor(r) {
    this.transformerRegistry = r;
  }
  /**
   * Process a domain event by transforming it to an integration event
   * if a suitable transformer is registered
   */
  async process(r, i) {
    const a = i.get("integration");
    if (!a) return;
    const d = this.transformerRegistry.find(r.eventType);
    if (!d) return;
    const g = d.transformToMultipleTargets(r);
    for (const T of g)
      await a.publish(T);
  }
}
function Je(O, r, i) {
  return {
    eventType: O,
    payload: r,
    metadata: {
      eventId: V.getUUID(),
      timestamp: /* @__PURE__ */ new Date(),
      schemaVersion: 1,
      ...i
    }
  };
}
class nt {
  /**
   * Creates a new transformer
   * @param sourceContext Name of the source bounded context
   * @param targetContext Optional name of the target bounded context
   */
  constructor(r, i) {
    this.sourceContext = r, this.contextRouter = i;
  }
  transformToMultipleTargets(r, i) {
    if (!this.contextRouter)
      return [this.transform(r, i)];
    const a = this.contextRouter.determineTargetContexts(r);
    return a.length === 0 ? [] : a.map(
      (d) => this.transform(r, {
        ...i,
        targetContext: d
      })
    );
  }
  /**
   * Transforms a domain event to an integration event
   * @param domainEvent Domain event to transform
   * @param additionalMetadata Optional additional metadata
   * @returns Transformed integration event
   */
  transform(r, i) {
    const a = this.transformPayload(r.payload), d = this.transformMetadata(
      r.metadata,
      i
    ), g = this.getIntegrationEventType(r.eventType);
    return Je(g, a, d);
  }
  /**
   * Transforms domain event metadata to integration metadata
   * @param domainMetadata Domain event metadata
   * @param additionalMetadata Additional metadata to add
   * @returns Metadata for integration event
   */
  transformMetadata(r, i) {
    const a = {
      // Add source and target context
      sourceContext: this.sourceContext,
      contextRouter: this.contextRouter,
      // Add schema version (default 1)
      schemaVersion: 1,
      // Add routing key (default is event type)
      routingKey: this.getRoutingKey(r),
      // Add additional metadata
      ...i
    };
    return r.correlationId !== void 0 && (a.correlationId = r.correlationId), r.eventId !== void 0 && (a.causationId = r.eventId), r.actor !== void 0 && (a.actor = r.actor), r.owner !== void 0 && (a.owner = r.owner), a;
  }
  /**
   * Returns integration event type based on domain event type
   * Default returns the same type, but can be overridden in derived classes
   * @param domainEventType Domain event type
   * @returns Integration event type
   */
  getIntegrationEventType(r) {
    return r;
  }
  /**
   * Generates routing key for integration event
   * Default uses event type or provides specific implementation
   * @param domainMetadata Domain event metadata
   * @returns Routing key for integration event
   */
  getRoutingKey(r) {
    return r.aggregateType ? `${r.aggregateType}.${r.eventType}` : r.eventType || "";
  }
}
export {
  pe as BaseEventBus,
  qe as CUSTOM_MIDDLEWARE_SYMBOL,
  ve as DomainEvent,
  nt as DomainToIntegrationTransformer,
  We as EventBusRegistry,
  Ke as EventHandler,
  et as InMemoryDomainEventBus,
  tt as InMemoryIntegrationEventBus,
  ye as IntegrationEvent,
  rt as IntegrationEventProcessor,
  Xe as UniversalEventDispatcher
};
