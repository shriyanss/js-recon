function webpack_328 (e, t, r) {
      "use strict";
      r.r(t),
        r.d(t, {
          default: function () {
            return c;
          },
        });
      var n = r(5893),
        l = r(7294),
        i = r(3967),
        o = r.n(i),
        a = r(3491),
        s = r(9754);
      function c(e) {
        var t, r;
        let i = l.createRef(),
          {
            elementId: c,
            className: d,
            fields: u = [],
            submitLabel: p,
            styles: f = {},
          } = e;
        if (0 === u.length) return null;
        let m = async (e) => {
          e.preventDefault();
          let t = new FormData(e.target),
            r = {};
          t.forEach((e, t) => {
            "string" == typeof e && (r[t] = e);
          });
          let n = await fetch(
              "https://m2xbcu4klqprtjl25jyr5bbtpi0lxias.lambda-url.ap-south-1.on.aws/",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(r),
              },
            ),
            l = await n.json();
          200 === n.status
            ? alert(l.message)
            : alert("Failed to submit form: " + l.error);
        };
        return (0, n.jsxs)("form", {
          className: o()(
            "sb-component",
            "sb-component-block",
            "sb-component-form-block",
            d,
          ),
          name: c,
          id: c,
          onSubmit: m,
          ref: i,
          children: [
            (0, n.jsxs)("div", {
              className: "grid sm:grid-cols-2 sm:gap-x-4",
              children: [
                (0, n.jsx)("input", {
                  type: "hidden",
                  name: "form-name",
                  value: c,
                }),
                u.map((e, t) => (0, n.jsx)(a.B, { ...e }, t)),
              ],
            }),
            (0, n.jsx)("div", {
              className: o()(
                "mt-4",
                (
                  null === (t = f.submitLabel) || void 0 === t
                    ? void 0
                    : t.textAlign
                )
                  ? (0, s.G)({
                      textAlign:
                        null === (r = f.submitLabel) || void 0 === r
                          ? void 0
                          : r.textAlign,
                    })
                  : null,
              ),
              children: (0, n.jsx)("button", {
                type: "submit",
                className:
                  "sb-component sb-component-block sb-component-button sb-component-button-primary",
                children: p,
              }),
            }),
          ],
        });
      }
    }