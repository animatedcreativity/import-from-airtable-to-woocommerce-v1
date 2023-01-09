var appConfig = {"mainFile":"main.js","minimal":"v1"};

var app = {
  start: async function() {
    var options = app.parseArgv(["type", "wc-api-url", "wc-consumer-key", "wc-consumer-secret", "airtable-base-name", "airtable-table-name", "airtable-view-name", "airtable-table-key", "airtable-key-name", "airtable-key-value", "import-fields", "airtable-api-key", "console-key", "console-prefix"]);
    console.log(options);
    if (app.has(options) && app.has(options.type) && app.has(app.sync[options.type])) {
      app.cliOptions = options;
      await app.sync[options.type].start(options);
      if (app.has(options.consoleKey)) app.exit(10);
    } else {
      console.log(app.consoleColors.bgRed, "Invalid options: ", options);
    }
  }
};
app.startUps = [];
app.workerStartUps= [];
app.callbacks = {static: []};app["api"] = {"airtable": (function() {
  var mod = {
    getRecords: async function(options, page, offset) {
      var fetchAll = !app.has(page) || page > 1;
      if (!app.has(page)) page = 1;
      var url = "https://api.airtable.com/v0/" + options.airtableBaseName + "/" + options.airtableTableName + "?view=" + options.airtableViewName + "&pageSize=100" + (app.has(offset) ? "&offset=" + offset : "");
      console.log(app.consoleColors.bgBlue, "Fetching airtable page:", page + " " + url.split(" ").join("+"));
      var result = await fetch(url, {
        headers: {
          "Authorization": "Bearer " + options.airtableApiKey
        }
      });
      if (result.status === 200) {
        var records = await result.json();
        var list = {};
        for (var i=0; i<=records.records.length-1; i++) {
          var record = records.records[i];
          if (app.has(record.fields) && app.has(record.fields[options.airtableTableKey]) && record.fields[options.airtableKeyName] === options.airtableKeyValue) {
            list[record.fields[options.airtableTableKey]] = record;
          }
        }
        if (!(!app.has(records.offset) || fetchAll !== true)) {
          var moreRecords = await mod.getRecords(options, page + 1, records.offset);
          for (var key in moreRecords) list[key] = moreRecords[key];
        }
        return list;
      }
    }
  };
  return mod;
})(), "woo": (function() {
  var mod = {
    updateProduct: async function(options, product) {
      var url = options.wcApiUrl + "/products/" + product.id;
      console.log(app.consoleColors.bgBlue, "Updating product:", (app.has(product.sku) ? product.sku : product.id) + " " + url);
      var result = await fetch(url, {
        method: "PUT",
        headers: {
          "Authorization": "Basic " + Buffer.from(options.wcConsumerKey + ":" + options.wcConsumerSecret).toString('base64'),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(product)
      });
      if (result.status === 200) {
        return true;
      }
      return false;
    },
    getLoadedProduct: function(list, key, value) {
      var filtered = [];
      for (var i=0; i<=list.length-1; i++) {
        var product = list[i];
        if (app.has(product[key]) && product[key] === value) {
          filtered.push(product);
        }
      }
      if (filtered.length === 0) return;
      if (filtered.length === 1) return filtered[0];
      return filtered;
    },
    getProduct: async function(options, sku) {
      var url = options.wcApiUrl + "/products?sku=" + sku;
      console.log(app.consoleColors.bgBlue, "Fetching product:", sku + " " + url);
      var result = await fetch(url, {
        headers: {
          "Authorization": "Basic " + Buffer.from(options.wcConsumerKey + ":" + options.wcConsumerSecret).toString('base64'),
          "Content-Type": "application/json"
        }
      });
      if (result.status === 200) {
        var json = await result.json();
        if (json.length > 0) return json[0];
      }
    },
    getProducts: async function(options, page) {
      var fetchAll = !app.has(page) || page > 1;
      if (!app.has(page)) page = 1;
      var url = options.wcApiUrl + "/products?page=" + page + "&per_page=100";
      console.log(app.consoleColors.bgBlue, "Fetching product page:", page + " " + url);
      var result = await fetch(url, {
        headers: {
          "Authorization": "Basic " + Buffer.from(options.wcConsumerKey + ":" + options.wcConsumerSecret).toString('base64'),
          "Content-Type": "application/json"
        }
      });
      if (result.status === 200) {
        var products = await result.json();
        if (products.length < 100 || fetchAll !== true) {
          return products;
        } else {
          var moreProducts = await mod.getProducts(options, page + 1);
          return app.has(moreProducts) ? products.concat(moreProducts) : undefined;
        }
      }
    }
  };
  return mod;
})(), };app["build"] = {};app["enhance"] = {"argv": (function() {
  var mod = {
    start: function() {
      app.parseArgv = function(list) {
        var options = {};
        for (var i=2; i<=process.argv.length-1; i++) {
          var option = process.argv[i];
          var name = option.split("=").shift().trim();
          var cName = app.camelCase(name).split("-").join("");
          var value = option.split("=").pop().trim();
          if (list.indexOf(name) >= 0) {
            options[cName] = value;
          } else {
            console.log(app.consoleColors.bgRed, "Invalid option: " + name);
            return;
          }
        }
        app.cliOptions = options;
        return options;
      };
    }
  };
  mod.start();
  return mod;
})(), "config": (function() {
  var mod = {
    start: function() {
      (function(left, right) {
        var copyConfig = function(left, right) {
          if (app.has(left) && app.has(right)) {
            for (var key in left) {
              var value = left[key];
              if (typeof value !== "object") {
                right[key] = value;
              } else {
                copyConfig(value, right[key]);
              }
            }
          }
        };
        copyConfig(left, right);
      })(appConfig.config, config);
    }
  };
  return mod;
})(), "console": (function() {
  var mod = {
    logged: false,
    start: function() {
      app.console = function() {
        if (app.has(app.cliOptions) && app.has(app.cliOptions.consoleKey)) {
          if (!app.has(mod.consoleRe)) {
            mod.consoleRe = require('console-remote-client').connect({server: "https://console.ylo.one:8088", channel: app.cliOptions.consoleKey});
          }
          var args = Array.prototype.slice.call(arguments);
          if (app.has(app.cliOptions.consolePrefix)) {
            args.unshift("[lime]" + app.cliOptions.consolePrefix + "[/lime]");
          }
          console.re.log.apply(null, args);
          mod.logged = true;
        }
      };
      app.exit = async function(time) {
        if (mod.logged === true) {
          console.log("Waiting for remote console...");
          if (!app.has(time)) time = 5; // 5 seconds
          await new Promise(function(resolve, reject) {
            setTimeout(function() { resolve(true); }, time * 1000);
          });
        }
        process.exit();
      };
      app.consoleColors = {
        reset: "\x1b[0m%s\x1b[0m",
        bright: "\x1b[1m%s\x1b[0m",
        dim: "\x1b[2m%s\x1b[0m",
        underscore: "\x1b[4m%s\x1b[0m",
        blink: "\x1b[5m%s\x1b[0m",
        reverse: "\x1b[7m%s\x1b[0m",
        hidden: "\x1b[8m%s\x1b[0m",
        fgBlack: "\x1b[30m%s\x1b[0m",
        fgRed: "\x1b[31m%s\x1b[0m",
        fgGreen: "\x1b[32m%s\x1b[0m",
        fgYellow: "\x1b[33m%s\x1b[0m",
        fgBlue: "\x1b[34m%s\x1b[0m",
        fgMagenta: "\x1b[35m%s\x1b[0m",
        fgCyan: "\x1b[36m%s\x1b[0m",
        fgWhite: "\x1b[37m%s\x1b[0m",
        fgGray: "\x1b[90m%s\x1b[0m",
        bgBlack: "\x1b[40m%s\x1b[0m",
        bgRed: "\x1b[41m%s\x1b[0m",
        bgGreen: "\x1b[42m%s\x1b[0m",
        bgYellow: "\x1b[43m%s\x1b[0m",
        bgBlue: "\x1b[44m%s\x1b[0m",
        bgMagenta: "\x1b[45m%s\x1b[0m",
        bgCyan: "\x1b[46m%s\x1b[0m",
        bgWhite: "\x1b[47m%s\x1b[0m",
        bgGray: "\x1b[100m%s\x1b[0m"
      };
    }
  };
  mod.start();
  return mod;
})(), "string": (function() {
  var mod = {
    start: function() {
      app.camelCase = function camelize(str, capitalFirst) {
        if (!app.has(capitalFirst)) capitalFirst = false;
        var result = str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word, index) {
          return index === 0 ? word.toLowerCase() : word.toUpperCase();
        }).replace(/\s+/g, '');
        if (capitalFirst) result = result.substr(0, 1).toUpperCase() + result.substr(1, 999);
        return result;
      };
      app.properCase = function(str) {
        return str.replace(
          /\w\S*/g,
          function(txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); }
        );
      };
    }
  };
  mod.start();
  return mod;
})(), "workers": (function() {
  var mod = {
    start: function() {
      app.workers = {
        index: 0,
        list: {},
        task: function(callback, taskName) {
          app.workers.index += 1;
          app.workers.list[app.workers.index] = {taskName: taskName, callback: callback};
        },
        count: function(taskName) {
          var count = 0;
          for (var index in app.workers.list) {
            var item = app.workers.list[index];
            if (item.name === taskName) count += 1;
          }
          return count;
        },
        do: async function(taskName) {
          return new Promise(function(resolve, reject) {
            for (var index in app.workers.list) {
              (async function(index) {
                var item = app.workers.list[index];
                if (taskName === item.taskName) {
                  await item.callback();
                  delete app.workers.list[index];
                  if (app.workers.count(taskName) <= 0) resolve(true);
                }
              })(index);
            }
          });
        }
      };
    }
  };
  mod.start();
  return mod;
})(), };app["publish"] = {};app["sync"] = {"product": (function() {
  var mod = {
    start: async function(options) {
      if (
        app.has(options.wcApiUrl)
        && app.has(options.wcConsumerKey)
        && app.has(options.wcConsumerSecret)
        && app.has(options.airtableBaseName)
        && app.has(options.airtableTableName)
        && app.has(options.airtableViewName)
        && app.has(options.airtableTableKey)
        && app.has(options.airtableKeyName)
        && app.has(options.airtableKeyValue)
        && Object.keys(app.utils.relatedFields.parse(options.importFields)).length > 0
        && app.has(options.airtableApiKey)
      ) {
        options.importFields = app.utils.relatedFields.parse(options.importFields);
        var airtableRecords = await app.api.airtable.getRecords(options);
        var wooProducts = await app.api.woo.getProducts(options);
        for (var key in airtableRecords) {
          var airtableRecord = airtableRecords[key];
          var product = app.api.woo.getLoadedProduct(wooProducts, "sku", key);
          if (app.has(product)) {
            var update = {id: product.id};
            for (var fieldKey in options.importFields) {
              var importField = options.importFields[fieldKey];
              if (app.has(airtableRecord.fields) && app.has(airtableRecord.fields[fieldKey])) {
                update[importField] = airtableRecord.fields[fieldKey];
                if (importField === "regular_price") update[importField] = String(Math.round(update[importField]));
              }
            }
            if (app.has(app.utils.object.changed(product, update, Object.keys(update)))) {
              if (await app.api.woo.updateProduct(options, update) === true) {
                console.log(app.consoleColors.bgMagenta, "Product updated:", key);
                app.console("[blue]Product updated:[/blue]", key);
              } else {
                console.log(app.consoleColors.bgRed, "Could not update:", key);
              }
            } else {
              console.log(app.consoleColors.bgGray, "Skipping, nothing changed:", key);
              app.console("[white]Skipping, nothing changed:[/white]", key);
            }
          } else {
            console.log(app.consoleColors.bgGray, "Woo product not found:", key);
          }
        }
      } else {
        console.log(app.consoleColors.bgRed, "Invalid/Missing options:", options);
      }
    }
  };
  return mod;
})(), };app["utils"] = {"object": (function() {
  var mod = {
    exists: function(list, key, value, parent) {
      // console.log(list, key, value, parent);
      if (!app.has(parent)) parent = "";
      for (var listKey in list) {
        var item = list[listKey];
        if (app.has(parent)) {
          if (item[parent][key] === value) return item;
        } else {
          if (item[key] === value) return item;
        }
      }
    },
    has: function(value) {
      return typeof value !== "undefined" && value !== null && value !== "" && value !== false;
    },
    changed: function(left, right, match, skip) {
      if (!app.has(skip)) skip = [];
      for (var i=0; i<=match.length-1; i++) {
        var key = match[i];
        if (
          skip.indexOf(key) < 0
          && left[key] !== right[key]
          && (mod.has(left[key]) || mod.has(right[key]))
        ) {
          // console.log(key, left[key], right[key], match);
          return key;
        }
      }
    },
    keyProperCase: function(obj) {
      for (var key in obj) {
        var value = obj[key];
        delete obj[key];
        key = app.utils.string.toProperCase(key);
        obj[key] = value;
      }
    }
  };
  return mod;
})(), "relatedFields": (function() {
  var mod = {
    parse: function(str) {
      if (!app.has(str)) str = "";
      var parts = str.split(",");
      var fields = {};
      for (var i=0; i<=parts.length-1; i++) {
        var part = parts[i];
        if (part.split("+").length === 2) {
          var parts2 = part.split("+");
          if (app.has(parts2[0]) && app.has(parts2[1])) {
            fields[parts2[0]] = parts2[1];
          }
        }
      }
      return fields;
    }
  };
  return mod;
})(), };
var config = app.config;
var modules = app.modules;
app.has = function(value) {
  var found = true;
  for (var i=0; i<=arguments.length-1; i++) {
    var value = arguments[i];
    if (!(typeof value !== "undefined" && value !== null && value !== "")) found = false;
  }
  return found;
};
if (!app.has(fetch)) {
  var fetch = require("node-fetch");
}
if (typeof app.start === "function") app.start();
