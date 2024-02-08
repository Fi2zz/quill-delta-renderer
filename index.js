var TypeBlock = "Block";
var TypeInline = "Inline";
var TypeList = "List";
var keyColor = "color";
var keyFontWeight = "font-weight";
var keyFontStyle = "font-style";
var keyTextDecoration = "text-decoration";
var keyFontSize = "font-size";
var keyTextAlign = "text-align";
var keyHeader = "header";
var keyAlign = "align";
var keyDirection = "direction";
var keyIndent = "indent";
var keyList = "list";
var keyVideo = "video";
var keyImage = "image";
var keyLink = "link";
var keyStrike = "strike";
var keyUnderline = "underline";
var keyItalic = "italic";
var keyBold = "bold";
var keySize = "size";
var keyText = "text";
var NewLine = "\n";
var Tags = {
	Link: "a",
	Image: "img",
	Video: "video",
	List: "li",
	Block: "p",
	Inline: "span",
	Bold: "strong",
	Italic: "i",
	Underline: "u",
	Strike: "s",
	bullet: "ul",
	ordered: "ol",
};
function tagGenerator(name, attrs = "", children = "") {
	const t = (name + " " + attrs).trim();
	return name == Tags.Image ? `<${t}/>` : `<${t}>${children}</${name}>`;
}
var br = "<br/>";
class Op {
	has(key) {
		return typeof this[key] != "undefined";
	}
	get(key) {
		return this[key];
	}
	isNewLine() {
		return this.textContent() == NewLine;
	}
	same(thier, key) {
		let our = this;
		if (!our.has(key) || !thier.has(key)) return false;
		return our.get(key) == thier.get(key);
	}
	textContent() {
		return this.get(keyText) || "";
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
	if (op.isNewLine() && !isContainerBlock(op)) return [{ tag: "" }];
	const tag = opToTag(op);
	const attrs = [opToStyle(op), opToClass(op)];
	if (tag == Tags.Image || tag == Tags.Video) {
		attrs.push(opToAttr(op, "src"));
		attrs.push(opToAttr(op, "width"));
	}
	if (tag == Tags.Link) attrs.push(opToAttr(op, keyLink));
	const attr = attrs.join(" ").trim();
	if (!attr.length && !tag) return [];
	if (attr.length && !tag) return [{ tag: Tags.Inline, attr }];
	const output = [];
	output.push({ tag, attr });
	if (tag != Tags.Link && op.has(keyLink)) {
		const attr2 = opToAttr(op, keyLink);
		output.push({ tag: Tags.Link, attr: attr2 });
	}
	return output;
}
function opToTag(op) {
	if (op.has(keyItalic)) return Tags.Italic;
	if (op.has(keyStrike)) return Tags.Strike;
	if (op.has(keyUnderline)) return Tags.Underline;
	if (op.has(keyBold)) return Tags.Bold;
	if (op.has(keyVideo)) return Tags.Video;
	if (op.has(keyImage)) return Tags.Image;
	if (op.has(keyLink)) return Tags.Link;
	if (op.has(keyHeader)) return "h" + op.get(keyHeader);
	if (op.has(keyList)) return Tags.List;
	if (isContainerBlock(op)) return Tags.Block;
	return null;
}
function opToClass(op) {
	let names = [keySize, keyIndent, keyDirection, keyAlign]
		.filter((key) => op.has(key))
		.map((key) => [key, op.get(key)])
		.map(([key, value]) => key + "-" + value);
	if (op.has(keyVideo)) names.push(keyVideo);
	if (op.has(keyImage)) names.push(keyImage);
	names = names.map((a) => `ql-${a}`);
	return names.length ? `class="${names.join(" ")}"` : "";
}
function opToStyle(op) {
	const names = [
		keyColor,
		keyFontSize,
		keyTextAlign,
		keyFontWeight,
		keyFontStyle,
		keyTextDecoration,
	]
		.filter((key) => op.has(key))
		.map((key) => `${key}:${op.get(key)};`);
	return names.length ? `style="${names.join(" ")}"` : "";
}
function opToAttr(op, key) {
	if (key == "src") return `${key}="${op.get(keyImage) || op.get(keyVideo)}"`;
	if (!op.has(key)) return "";
	const name = key == keyLink ? "href" : key;
	return `${name}="${op.get(key)}"`;
}
function isContainerBlock(op) {
	return [
		keyList,
		keyHeader,
		keyAlign,
		keyTextAlign,
		keyDirection,
		keyIndent,
	].some((key) => op.has(key));
}
function deltaReducer(acc, op) {
	if (!op || typeof op !== "object" || typeof op.insert == "undefined")
		return acc;
	if (typeof op.insert === "object" || op.insert === NewLine)
		return acc.concat(op);
	const reducer = (acc2, insert, index, { length }) => {
		if (index == length - 1) return insert == "" ? acc2 : acc2.concat(insert);
		if (insert !== "") return acc2.concat(insert, NewLine);
		return acc2.concat(NewLine);
	};
	const reduced = op.insert
		.split(NewLine)
		.reduce(reducer, [])
		.map((insert) => ({ ...op, insert }));
	return acc.concat(reduced);
}
function deltaToOpReducer(acc, deltaOp) {
	let insert = deltaOp.insert;
	if (typeof insert == "undefined" || insert == null) return acc;
	if (typeof insert === "object" && !Object.keys(insert).length) return acc;
	const attrs = deltaOp.attributes || {};
	const op = new Op();
	for (let key in attrs) {
		const value = attrs[key];
		if (typeof value == "undefined") continue;
		op[key] = value;
	}
	if (typeof insert == "string") {
		op[keyText] = insert;
	} else if (typeof insert == "object") {
		for (let key in insert) op[key] = insert[key];
	}
	return acc.concat(op);
}
function opsToGroups(deltaOps) {
	const ops = deltaOps.reduce(deltaReducer, []).reduce(deltaToOpReducer, []);
	let groups = [];
	for (let index = ops.length - 1; index >= 0; index--) {
		const [startIndex, group] = opsToGroup(ops, index);
		index = startIndex > -1 ? startIndex : index;
		groups.unshift(group);
	}
	function reduceListGroup(acc, group) {
		if (group.length === 1) return acc.concat(group);
		let map = (items) => new Group(TypeList, items);
		const gs = group
			.flatMap((g) => g.items)
			.reduce(createListReducer("attr"), []);
		return acc.concat(gs.map(map));
	}
	return groups
		.reduce(createListReducer("group"), [])
		.reduce(reduceListGroup, []);
}
function opsToGroup(ops, index) {
	const op = ops[index];
	const block = isContainerBlock(op);
	const type = block ? TypeBlock : TypeInline;
	const items = [];
	let startIndex = -1;
	const accept = (op2) => {
		if (!block) return !isContainerBlock(op2);
		return !(op2.isNewLine() || isContainerBlock(op2));
	};
	for (var i = index - 1; i >= 0; i--) {
		const op2 = ops[i];
		if (!accept(op2)) break;
		startIndex = i;
		items.unshift(op2);
	}
	if (!block) items.push(op);
	const group = new Group(type, items, block ? op : null);
	if (type == TypeBlock && op.has(keyList)) {
		return [startIndex, new Group(TypeList, [group], op)];
	}
	return [startIndex, group];
}
function createListReducer(type) {
	const isList = (group) => group.type == TypeList;
	const same = (c, p) => c.op.same(p.op, keyList);
	const matcher = (current, prev) => {
		if (type == "attr") return same(current, prev);
		if (!isList(current) || !isList(prev)) return false;
		const c = current.items[0];
		const p = prev.items[0];
		return same(c, p);
	};
	return function (acc, current, index, items) {
		if (index > 0 && matcher(current, items[index - 1])) {
			acc[acc.length - 1].push(current);
		} else {
			acc.push([current]);
		}
		return acc;
	};
}
function tagsToString(tags, content) {
	if (!tags.length) return content;
	let html = content;
	for (let node of tags) {
		if (node.tag == "") html = br;
		else html = tagGenerator(node.tag, node.attr, html);
	}
	return html.trim();
}
function opsToString(ops) {
	let lastOp = ops[ops.length - 1];
	if (lastOp && lastOp.isNewLine()) ops = ops.slice(0, ops.length - 1);
	if (ops.length <= 0) return "";
	let str = "";
	for (let op of ops) str += tagsToString(tagsGenerator(op), op.textContent());
	return str;
}
function renderList(list) {
	const items = list.items;
	const [first] = items;
	const type = first.op.get(keyList);
	const tag = Tags[type];
	return tagGenerator(tag, "", renderBlock(items));
}
function renderBlock(group) {
	let html = "";
	for (let { op, items: ops } of group) {
		const content = opsToString(ops);
		html += tagsToString(tagsGenerator(op), content);
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
export default function (delta) {
	if (!delta) return "";
	if (!Array.isArray(delta.ops) || delta.ops.length <= 0) return "";
	const renderGroup = (group) => {
		if (group.type == TypeList) return renderList(group);
		if (group.type == TypeBlock) return renderBlock([group]);
		return renderLines(group);
	};
	return opsToGroups(delta.ops).map(renderGroup).join("").trim();
}
