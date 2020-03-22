module.exports = {
  "rid": "manage_sensors",
  "meta": {
    "use": [
      {
        "kind": "module",
        "rid": "io.picolabs.subscription",
        "alias": "Subscriptions"
      },
      {
        "kind": "module",
        "rid": "io.picolabs.wrangler",
        "alias": "wrangler"
      }
    ],
    "shares": [
      "__testing",
      "sensors",
      "getAllTemperatures"
    ],
    "provides": [
      "getAllTemperatures",
      "sensors"
    ]
  },
  "global": async function (ctx) {
    ctx.scope.set("default_location", "pandora");
    ctx.scope.set("default_sms", "19134019979");
    ctx.scope.set("default_threshold", 80);
    ctx.scope.set("report_id", 1);
    ctx.scope.set("getAllTemperatures", ctx.mkFunction([], async function (ctx, args) {
      return await ctx.applyFn(ctx.scope.get("map"), ctx, [
        await ctx.applyFn(await ctx.modules.get(ctx, "Subscriptions", "established"), ctx, [
          "Tx_role",
          "sensor"
        ]),
        ctx.mkFunction(["subscription"], async function (ctx, args) {
          ctx.scope.set("subscription", args["subscription"]);
          ctx.scope.set("subscription", await ctx.applyFn(ctx.scope.get("head"), ctx, [await ctx.applyFn(ctx.scope.get("klog"), ctx, [
              ctx.scope.get("subscription"),
              "getAllTemperatures subscription"
            ])]));
          return await ctx.applyFn(await ctx.modules.get(ctx, "wrangler", "skyQuery"), ctx, [
            await ctx.applyFn(ctx.scope.get("get"), ctx, [
              ctx.scope.get("subscription"),
              "Tx"
            ]),
            "temperature_store",
            "temperatures",
            {}
          ]);
        })
      ]);
    }));
    ctx.scope.set("getChildren", ctx.mkFunction([], async function (ctx, args) {
      return await ctx.applyFn(await ctx.modules.get(ctx, "wrangler", "children"), ctx, []);
    }));
    ctx.scope.set("nameFromID", ctx.mkFunction(["name"], async function (ctx, args) {
      ctx.scope.set("name", args["name"]);
      return await ctx.applyFn(ctx.scope.get("+"), ctx, [
        await ctx.applyFn(ctx.scope.get("+"), ctx, [
          "Sensor ",
          ctx.scope.get("name")
        ]),
        " Pico"
      ]);
    }));
    ctx.scope.set("sensors", ctx.mkFunction([], async function (ctx, args) {
      return await ctx.modules.get(ctx, "ent", "sensors");
    }));
    ctx.scope.set("__testing", {
      "queries": [{
          "name": "getAllTemperatures",
          "args": []
        }],
      "events": [
        {
          "domain": "sensor",
          "type": "new_sensor",
          "attrs": ["sensor_id"]
        },
        {
          "domain": "sensor",
          "type": "unneeded_sensor",
          "attrs": ["sensor_id"]
        },
        {
          "domain": "sensor",
          "type": "subscription_wanted",
          "attrs": [
            "sensor_id",
            "eci"
          ]
        }
      ]
    });
  },
  "rules": {
    "create_sensor": {
      "name": "create_sensor",
      "select": {
        "graph": { "sensor": { "new_sensor": { "expr_0": true } } },
        "state_machine": {
          "start": [[
              "expr_0",
              "end"
            ]]
        }
      },
      "body": async function (ctx, runAction, toPairs) {
        ctx.scope.set("sensor_id", await ctx.applyFn(await ctx.modules.get(ctx, "event", "attr"), ctx, ["sensor_id"]));
        ctx.scope.set("exists", await ctx.applyFn(ctx.scope.get("><"), ctx, [
          await ctx.applyFn(ctx.scope.get("keys"), ctx, [await ctx.modules.get(ctx, "ent", "sensors")]),
          ctx.scope.get("sensor_id")
        ]));
        ctx.scope.set("eci", await ctx.modules.get(ctx, "meta", "eci"));
        var fired = ctx.scope.get("exists");
        if (fired) {
          await runAction(ctx, void 0, "send_directive", [
            "sensor_ready",
            { "sensor_id": ctx.scope.get("sensor_id") }
          ], []);
        }
        if (fired)
          ctx.emit("debug", "fired");
        else
          ctx.emit("debug", "not fired");
        if (!fired) {
          await ctx.modules.set(ctx, "ent", "sensors", await ctx.applyFn(ctx.scope.get("put"), ctx, [
            await ctx.applyFn(ctx.scope.get("defaultsTo"), ctx, [
              await ctx.modules.get(ctx, "ent", "sensors"),
              {}
            ]),
            [ctx.scope.get("sensor_id")],
            ""
          ]));
          await ctx.raiseEvent({
            "domain": "wrangler",
            "type": "child_creation",
            "attributes": {
              "name": await ctx.applyFn(ctx.scope.get("nameFromID"), ctx, [ctx.scope.get("sensor_id")]),
              "color": "#ffff00",
              "sensor_id": ctx.scope.get("sensor_id"),
              "rids": [
                "sensor_profile",
                "wovyn_base",
                "temperature_store",
                "io.picolabs.subscription"
              ]
            },
            "for_rid": undefined
          });
        }
      }
    },
    "initialize_sensor_profile": {
      "name": "initialize_sensor_profile",
      "select": {
        "graph": { "wrangler": { "child_initialized": { "expr_0": true } } },
        "state_machine": {
          "start": [[
              "expr_0",
              "end"
            ]]
        }
      },
      "body": async function (ctx, runAction, toPairs) {
        ctx.scope.set("sensor_id", await ctx.applyFn(await ctx.modules.get(ctx, "event", "attr"), ctx, ["sensor_id"]));
        ctx.scope.set("exists", await ctx.applyFn(ctx.scope.get("><"), ctx, [
          await ctx.applyFn(ctx.scope.get("keys"), ctx, [await ctx.modules.get(ctx, "ent", "sensors")]),
          ctx.scope.get("sensor_id")
        ]));
        ctx.scope.set("eci", await ctx.applyFn(ctx.scope.get("klog"), ctx, [
          await ctx.applyFn(await ctx.modules.get(ctx, "event", "attr"), ctx, ["eci"]),
          "SETTING ECI"
        ]));
        var fired = ctx.scope.get("exists");
        if (fired) {
          await runAction(ctx, "event", "send", [{
              "eci": ctx.scope.get("eci"),
              "eid": "initialize-sensor-profile",
              "domain": "sensor",
              "type": "profile_updated",
              "attrs": {
                "location": ctx.scope.get("default_location"),
                "name": ctx.scope.get("section_id"),
                "sms": ctx.scope.get("default_sms"),
                "high_temperature": ctx.scope.get("default_threshold")
              }
            }], []);
        }
        if (fired)
          ctx.emit("debug", "fired");
        else
          ctx.emit("debug", "not fired");
        if (fired) {
          await ctx.raiseEvent({
            "domain": "wrangler",
            "type": "subscription",
            "attributes": {
              "name": "sensors",
              "wellKnown_Tx": ctx.scope.get("eci"),
              "Rx_role": "manager",
              "Tx_role": "sensor"
            },
            "for_rid": undefined
          });
        }
      }
    },
    "subscribe_sensor": {
      "name": "subscribe_sensor",
      "select": {
        "graph": { "sensor": { "subscription_wanted": { "expr_0": true } } },
        "state_machine": {
          "start": [[
              "expr_0",
              "end"
            ]]
        }
      },
      "body": async function (ctx, runAction, toPairs) {
        ctx.scope.set("sensor_id", await ctx.applyFn(await ctx.modules.get(ctx, "event", "attr"), ctx, ["sensor_id"]));
        ctx.scope.set("exists", await ctx.applyFn(ctx.scope.get("any"), ctx, [
          await ctx.applyFn(await ctx.modules.get(ctx, "Subscriptions", "established"), ctx, [
            "Tx_role",
            "sensor"
          ]),
          ctx.mkFunction(["x"], async function (ctx, args) {
            ctx.scope.set("x", args["x"]);
            return await ctx.applyFn(ctx.scope.get("=="), ctx, [
              await ctx.applyFn(ctx.scope.get("get"), ctx, [
                ctx.scope.get("x"),
                "peer_id"
              ]),
              ctx.scope.get("sensor_id")
            ]);
          })
        ]));
        var fired = true;
        if (fired)
          ctx.emit("debug", "fired");
        else
          ctx.emit("debug", "not fired");
        await ctx.raiseEvent({
          "domain": "wrangler",
          "type": "subscription",
          "attributes": {
            "name": "sensors",
            "wellKnown_Tx": await ctx.applyFn(await ctx.modules.get(ctx, "event", "attr"), ctx, ["eci"]),
            "Rx_role": "manager",
            "Tx_role": "sensor"
          },
          "for_rid": undefined
        });
      }
    },
    "delete_sensor": {
      "name": "delete_sensor",
      "select": {
        "graph": { "sensor": { "unneeded_sensor": { "expr_0": true } } },
        "state_machine": {
          "start": [[
              "expr_0",
              "end"
            ]]
        }
      },
      "body": async function (ctx, runAction, toPairs) {
        ctx.scope.set("sensor_id", await ctx.applyFn(ctx.scope.get("head"), ctx, [await ctx.applyFn(ctx.scope.get("klog"), ctx, [
            await ctx.applyFn(await ctx.modules.get(ctx, "event", "attr"), ctx, ["sensor_id"]),
            "sensor_id"
          ])]));
        ctx.scope.set("exists", await ctx.applyFn(ctx.scope.get("><"), ctx, [
          await ctx.applyFn(ctx.scope.get("keys"), ctx, [await ctx.modules.get(ctx, "ent", "sensors")]),
          ctx.scope.get("sensor_id")
        ]));
        ctx.scope.set("child_to_delete", await ctx.applyFn(ctx.scope.get("nameFromID"), ctx, [ctx.scope.get("sensor_id")]));
        var fired = ctx.scope.get("exists");
        if (fired) {
          await runAction(ctx, void 0, "send_directive", [
            "deleting_sensor",
            { "sensor_id": ctx.scope.get("sensor_id") }
          ], []);
        }
        if (fired)
          ctx.emit("debug", "fired");
        else
          ctx.emit("debug", "not fired");
        if (fired) {
          await ctx.modules.set(ctx, "ent", "sensors", await ctx.applyFn(ctx.scope.get("delete"), ctx, [
            await ctx.modules.get(ctx, "ent", "sensors"),
            [ctx.scope.get("sensor_id")]
          ]));
          await ctx.raiseEvent({
            "domain": "wrangler",
            "type": "child_deletion",
            "attributes": { "name": ctx.scope.get("child_to_delete") },
            "for_rid": undefined
          });
        }
      }
    },
    "request_all_temperatures": {
      "name": "request_all_temperatures",
      "select": {
        "graph": { "sensor": { "requested_all_temperatures": { "expr_0": true } } },
        "state_machine": {
          "start": [[
              "expr_0",
              "end"
            ]]
        }
      },
      "body": async function (ctx, runAction, toPairs) {
        var foreach0_pairs = toPairs(await ctx.applyFn(await ctx.modules.get(ctx, "Subscriptions", "established"), ctx, [
          "Tx_role",
          "sensor"
        ]));
        var foreach0_len = foreach0_pairs.length;
        var foreach0_i;
        for (foreach0_i = 0; foreach0_i < foreach0_len; foreach0_i++) {
          var foreach_is_final = foreach0_i === foreach0_len - 1;
          ctx.scope.set("subscription", foreach0_pairs[foreach0_i][1]);
          var fired = await ctx.applyFn(ctx.scope.get("=="), ctx, [
            await ctx.applyFn(ctx.scope.get("klog"), ctx, [
              await ctx.applyFn(ctx.scope.get("get"), ctx, [
                ctx.scope.get("subscription"),
                "Tx_role"
              ]),
              "TX_ROLE"
            ]),
            "sensor"
          ]);
          if (fired) {
            await runAction(ctx, "event", "send", [{
                "eci": await ctx.applyFn(ctx.scope.get("get"), ctx, [
                  ctx.scope.get("subscription"),
                  "Tx"
                ]),
                "eid": "getting_temperatures",
                "domain": "sensor",
                "type": "temperatures",
                "attrs": {
                  "return_eci": await ctx.applyFn(ctx.scope.get("get"), ctx, [
                    ctx.scope.get("subscription"),
                    "Rx"
                  ]),
                  "sensor_id": await ctx.applyFn(ctx.scope.get("get"), ctx, [
                    ctx.scope.get("subscription"),
                    "Tx"
                  ])
                }
              }], []);
          }
          if (fired)
            ctx.emit("debug", "fired");
          else
            ctx.emit("debug", "not fired");
          if (fired) {
            if (typeof foreach_is_final === "undefined" || foreach_is_final)
              ctx.scope.set("report_id", await ctx.applyFn(ctx.scope.get("+"), ctx, [
                ctx.scope.get("report_id"),
                1
              ]));
          }
        }
      }
    },
    "get_all_temperatures": {
      "name": "get_all_temperatures",
      "select": {
        "graph": { "sensor": { "released_temperature": { "expr_0": true } } },
        "state_machine": {
          "start": [[
              "expr_0",
              "end"
            ]]
        }
      },
      "body": async function (ctx, runAction, toPairs) {
        ctx.scope.set("sensor_id", await ctx.applyFn(await ctx.modules.get(ctx, "event", "attr"), ctx, ["sensor_id"]));
        ctx.scope.set("temps", await ctx.applyFn(await ctx.modules.get(ctx, "event", "attr"), ctx, ["temps"]));
        var fired = true;
        if (fired)
          ctx.emit("debug", "fired");
        else
          ctx.emit("debug", "not fired");
      }
    }
  }
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IiIsInNvdXJjZXNDb250ZW50IjpbXX0=
