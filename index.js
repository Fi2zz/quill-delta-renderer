const TypeBlock = "Block";
const TypeInline = "Inline";
const TypeList = "List";
const keyColor = "color";
const keyFontWeight = "font-weight";
const keyFontStyle = "font-style";
const keyTextDecoration = "text-decoration";
const keyFontSize = "font-size";
const keyTextAlign = "text-align";
const keyHeader = "header";
const keyAlign = "align";
const keyDirection = "direction";
const keyIndent = "indent";
const keyList = "list";
const keyVideo = "video";
const keyImage = "image";
const keyLink = "link";
const keyHref = "href";
const keySrc = "src";
const keyWidth = "width";
const keyStyle = "style";
const keyClass = "class";
const keyStrike = "strike";
const keyUnderline = "underline";
const keyItalic = "italic";
const keyBold = "bold";
const keySize = "size";
const keyText = "text";
const NewLine = "\n";
const Tags = {
  Link: "a",
  Image: "img",
  Video: "video",
  Break: "br",
  List: "li",
  Block: "p",
  Inline: "span",
  Header: "h",
  Bullet: "ul",
  Ordered: "ol",
  Bold: "strong",
  Italic: "i",
  Underline: "u",
  Strike: "s"
};
function tagGenerator(name, attrs = "", children = "") {
  const t = attrs.length ? `${name} ${attrs}` : name;
  const c = name == Tags.Image;
  return c ? `<${t}/>` : `<${t}>${children}</${name}>`;
}
const br = "<br/>";
class Op extends Map {
  tag = "";
  isNewLine() {
    return this.text() == NewLine;
  }
  same(thier, key) {
    let our = this;
    if (!our.has(key) || !thier.has(key))
      return false;
    return our.get(key) == thier.get(key);
  }
  text() {
    return this.get(keyText);
  }
}
class Group {
  constructor(type, items, op = null) {
    this.type = type;
    this.items = items;
    this.op = op;
  }
}
function tagsGenerator(op) {
  if (op.isNewLine() && !isContainerBlock(op))
    return [{ tag: "" }];
  const tag = opToString(op, "tag");
  const attrs = [
    opToString(op, keyWidth),
    opToString(op, keySrc),
    opToString(op, keyStyle),
    opToString(op, keyClass)
  ];
  if (tag == Tags.Link)
    attrs.push(opToString(op, keyHref));
  const attr = attrs.join(" ").trim();
  if (!attr.length && !tag)
    return [];
  if (attr.length && !tag)
    return [{ tag: Tags.Inline, attr }];
  const output = [];
  output.push({ tag, attr });
  if (tag != Tags.Link && op.has(keyHref)) {
    const attr2 = opToString(op, keyHref);
    output.push({ tag: Tags.Link, attr: attr2 });
  }
  return output;
}
function opToString(op, key) {
  if (key == "tag") {
    if (op.has(keyItalic))
      return Tags.Italic;
    if (op.has(keyStrike))
      return Tags.Strike;
    if (op.has(keyUnderline))
      return Tags.Underline;
    if (op.has(keyBold))
      return Tags.Bold;
    if (op.has(keyVideo))
      return Tags.Video;
    if (op.has(keyImage))
      return Tags.Image;
    if (op.has(keyHref))
      return Tags.Link;
    if (op.has(keyHeader))
      return Tags.Header + op.get(keyHeader);
    const indent = op.has(keyIndent);
    const list = op.has(keyList);
    if (list || list && indent)
      return Tags.List;
    if (op.has(keyTextAlign) || op.has(keyAlign) || indent || op.has(keyDirection))
      return Tags.Block;
    return null;
  }
  if (key == keyClass) {
    const names = [keySize, keyIndent, keyDirection, keyAlign].filter((key2) => op.has(key2)).map((key2) => [key2, op.get(key2)]).map(([key2, value]) => key2 + "-" + value).concat(op.has(keyImage) ? keyImage : "").concat(op.has(keyVideo) ? keyVideo : "").filter(Boolean).map((a) => `ql-${a}`);
    return names.length ? `${key}="${names.join(" ")}"` : "";
  }
  if (key == keyStyle) {
    const style = [
      keyColor,
      keyFontSize,
      keyTextAlign,
      keyFontWeight,
      keyFontStyle,
      keyTextDecoration
    ].filter((k) => op.has(k)).map((key2) => `${key2}:${op.get(key2)};`);
    return style.length ? `${key}="${style.join("")}"` : "";
  }
  if (key == keySrc) {
    if (!op.has(keyImage) && !op.has(keyVideo))
      return "";
    return `${key}=${op.get(keyImage) || op.get(keyVideo)}`;
  }
  if (key == keyWidth && !op.has(keyImage) && !op.has(keyVideo))
    return "";
  return op.has(key) ? `${key}="${op.get(key)}"` : "";
}
function isContainerBlock(op) {
  return [
    keyTextAlign,
    keyList,
    keyHeader,
    keyAlign,
    keyTextAlign,
    keyDirection,
    keyIndent
  ].some((key) => op.has(key));
}
function deltaReducer(acc, op) {
  if (!op || typeof op !== "object" || typeof op.insert == "undefined")
    return acc;
  if (typeof op.insert === "object" || op.insert === NewLine)
    return acc.concat(op);
  const reducer = (acc2, insert, index, { length }) => {
    const pushed = [];
    if (index == length - 1) {
      if (insert == "")
        return acc2;
      pushed.push(insert);
    } else if (insert !== "") {
      pushed.push(insert);
      pushed.push(NewLine);
    } else
      pushed.push(NewLine);
    return acc2.concat(pushed);
  };
  const reduced = op.insert.split(NewLine).reduce(reducer, []).map((insert) => ({ ...op, insert }));
  return acc.concat(reduced);
}
function opsToGroups(dops) {
  let ops = dops.reduce(deltaReducer, []).reduce(deltaToOpReducer, []);
  let groups = [];
  for (let index = ops.length - 1; index >= 0; index--) {
    const [startIndex, group] = getGroup(ops, index);
    index = startIndex > -1 ? startIndex : index;
    groups.unshift(group);
  }
  const flatListGroup = (acc, group) => acc.concat(group.items);
  function reduceListGroup(acc, group) {
    if (group.length === 1)
      return acc.concat(group);
    const gs = group.reduce(flatListGroup, []).reduce(createListReducer("attr"), []).map((items) => new Group(TypeList, items));
    return acc.concat(gs);
  }
  return groups.reduce(createListReducer("group"), []).reduce(reduceListGroup, []);
}
function getGroup(ops, index) {
  const op = ops[index];
  const block = isContainerBlock(op);
  const type = block ? TypeBlock : TypeInline;
  const items = [];
  let startIndex = -1;
  const accept = (op2) => {
    if (!block)
      return !isContainerBlock(op2);
    return !(op2.isNewLine() || isContainerBlock(op2));
  };
  for (var i = index - 1; i >= 0; i--) {
    const op2 = ops[i];
    if (!accept(op2))
      break;
    startIndex = i;
    items.unshift(op2);
  }
  if (!block)
    items.push(op);
  const group = new Group(type, items, block ? op : null);
  if (type == TypeBlock && op.has(keyList)) {
    return [startIndex, new Group(TypeList, [group], op)];
  }
  return [startIndex, group];
}
function deltaToOpReducer(acc, deltaOp) {
  let insert = deltaOp.insert;
  if (typeof insert == "undefined" || insert == null)
    return acc;
  if (typeof insert === "object" && !Object.keys(insert).length)
    return acc;
  let attrs = deltaOp.attributes || {};
  let op = new Op();
  for (let key in attrs) {
    const value = attrs[key];
    if (typeof value == "undefined")
      continue;
    op.set(key, value);
  }
  if (op.has(keyLink))
    op.set(keyHref, op.get(keyLink));
  if (typeof insert == "string") {
    op.set(keyText, insert);
  } else if (typeof insert == "object") {
    for (let key in insert)
      op.set(key, insert[key]);
  }
  return acc.concat(op);
}
function createListReducer(type) {
  const isList = (group) => group.type == TypeList;
  const same = (c, p) => c.op.same(p.op, keyList);
  const matcher = (current, prev) => {
    if (type == "attr")
      return same(current, prev);
    if (!isList(current) || !isList(prev))
      return false;
    const c = current.items[0];
    const p = prev.items[0];
    return same(c, p);
  };
  return function(result, current, index, items) {
    if (index > 0 && matcher(current, items[index - 1])) {
      result[result.length - 1].push(current);
    } else {
      result.push([current]);
    }
    return result;
  };
}
function stringifier(tags, content) {
  content = content.trim();
  if (!tags.length)
    return content;
  let html = content;
  for (let node of tags) {
    if (typeof node == "string")
      node = { tag: node, attr: "" };
    if (node.tag == "")
      html = br;
    else
      html = tagGenerator(node.tag, node.attr, html).toString();
  }
  return html.trim();
}
function opsToString(ops) {
  let lastOp = ops[ops.length - 1];
  if (lastOp && lastOp.isNewLine())
    ops = ops.slice(0, ops.length - 1);
  if (ops.length <= 0)
    return "";
  let str = "";
  for (let op of ops)
    str += stringifier(tagsGenerator(op), op.text() || "");
  return str;
}
function getListTag(group) {
  const items = group.items;
  let op = items[0].op;
  const list = op.get(keyList);
  if (!list)
    return "";
  let n = list[0].toUpperCase() + list.slice(1);
  return Tags[n];
}
function renderList(list) {
  const tag = getListTag(list);
  return tagGenerator(tag, "", renderBlock(list.items));
}
function renderBlock(group) {
  let html = "";
  for (let { op, items: ops } of group) {
    const content = opsToString(ops);
    html += stringifier(tagsGenerator(op), content);
  }
  return html;
}
function renderLines(group) {
  const html = opsToString(group.items);
  let result = "";
  for (let str of html.split(br))
    result += tagGenerator(Tags.Block, "", str.length ? str : br);
  return result;
}
export default 
function (delta) {
  if (!delta)
    return "";
  if (!Array.isArray(delta.ops) || delta.ops.length <= 0)
    return "";
  const renderGroup = (group) => {
    if (group.type == TypeList)
      return renderList(group);
    if (group.type == TypeBlock)
      return renderBlock([group]);
    return renderLines(group);
  };
  return opsToGroups(delta.ops).map(renderGroup).join("").trim();
}



