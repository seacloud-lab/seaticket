var deepmerge = require('deepmerge').default;
var sanitize = require('hast-util-sanitize');
var gh = require('hast-util-sanitize/lib/github');
var toHTML = require('hast-util-to-html');
var format = require('rehype-format');
var raw = require('rehype-raw');
var breaks = require('remark-breaks');
var markdown = require('remark-parse');
var remark2rehype = require('remark-rehype');
var slug = require('remark-slug');
var unified = require('unified');
var xtend = require('xtend');

function stringify(config) {
  var settings = xtend(config, this.data('settings'));
  var schema = deepmerge(gh, {
    'attributes': {
      'input': [
        'type',
      ],
      'li': [
        'className'
      ],
      'code': [
        'className',
      ],
    },
    'tagNames': [
      'input',
      'code'
    ]
  });
  this.Compiler = compiler;

  function compiler(tree) {
    // use sanity to remove dangerous html, the default is
    var hast = sanitize(tree, schema);
    return toHTML(hast, settings);
  }
}

// markdown -> mdast -> html AST -> html
var processor = unified()
  .use(markdown, { commonmark: true })
  .use(breaks)
  .use(slug)
  .use(remark2rehype, { allowDangerousHTML: true })
  .use(raw)
  .use(format)
  .use(stringify);

var processorGetAST = unified()
  .use(markdown, { commonmark: true })
  .use(slug);

export { processor, processorGetAST };
