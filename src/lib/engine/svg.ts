import { StripOptions } from './types';

/**
 * Lightweight XML DOM node representation for Node.js / non-browser environments.
 */
class SimpleNode {
  nodeType: number;
  nodeName: string;
  childNodes: SimpleNode[] = [];
  parentNode: SimpleNode | null = null;

  constructor(nodeType: number, nodeName: string) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
  }

  appendChild<T extends SimpleNode>(child: T): T {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild<T extends SimpleNode>(child: T): T {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove(): void {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }
}

class SimpleElement extends SimpleNode {
  tagName: string;
  localName: string;
  attributes: Map<string, string> = new Map();

  constructor(tagName: string) {
    super(1, tagName);
    this.tagName = tagName;
    this.localName = tagName.includes(':') ? tagName.split(':')[1] : tagName;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) || null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  querySelectorAll(selector: string): SimpleElement[] {
    const matches: SimpleElement[] = [];
    const walk = (el: SimpleNode) => {
      for (const child of el.childNodes) {
        if (child.nodeType === 1) {
          const elem = child as SimpleElement;
          const sel = selector.toLowerCase();
          const tName = elem.tagName.toLowerCase();
          const lName = elem.localName.toLowerCase();
          if (sel === '*' || tName === sel || lName === sel || tName.endsWith(':' + sel)) {
            matches.push(elem);
          }
          walk(elem);
        }
      }
    };
    walk(this);
    return matches;
  }

  querySelector(selector: string): SimpleElement | null {
    return this.querySelectorAll(selector)[0] || null;
  }
}

class SimpleComment extends SimpleNode {
  data: string;
  constructor(data: string) {
    super(8, '#comment');
    this.data = data;
  }
}

class SimpleText extends SimpleNode {
  data: string;
  constructor(data: string) {
    super(3, '#text');
    this.data = data;
  }
}

class SimplePI extends SimpleNode {
  target: string;
  data: string;
  constructor(target: string, data: string) {
    super(7, target);
    this.target = target;
    this.data = data;
  }
}

class SimpleDocument extends SimpleNode {
  documentElement: SimpleElement | null = null;
  constructor() {
    super(9, '#document');
  }

  querySelectorAll(selector: string): SimpleElement[] {
    return this.documentElement ? this.documentElement.querySelectorAll(selector) : [];
  }

  querySelector(selector: string): SimpleElement | null {
    if (selector === 'parsererror') {
      const walk = (node: SimpleNode): SimpleElement | null => {
        if (
          node.nodeType === 1 &&
          ((node as SimpleElement).tagName.toLowerCase() === 'parsererror' ||
            (node as SimpleElement).localName.toLowerCase() === 'parsererror')
        ) {
          return node as SimpleElement;
        }
        for (const child of node.childNodes) {
          const res = walk(child);
          if (res) return res;
        }
        return null;
      };
      return walk(this);
    }
    return this.documentElement ? this.documentElement.querySelector(selector) : null;
  }
}

function parseXmlFallback(xmlString: string): SimpleDocument {
  const doc = new SimpleDocument();
  let pos = 0;
  let current: SimpleNode = doc;
  const len = xmlString.length;

  while (pos < len) {
    const nextLt = xmlString.indexOf('<', pos);
    if (nextLt === -1) {
      if (pos < len) {
        const text = xmlString.slice(pos);
        if (text.trim() || current !== doc) {
          current.appendChild(new SimpleText(text));
        }
      }
      break;
    }

    if (nextLt > pos) {
      const text = xmlString.slice(pos, nextLt);
      if (current !== doc) {
        current.appendChild(new SimpleText(text));
      }
    }

    pos = nextLt;

    // Comment <!-- ... -->
    if (xmlString.startsWith('<!--', pos)) {
      const end = xmlString.indexOf('-->', pos + 4);
      if (end === -1) {
        const err = new SimpleElement('parsererror');
        err.appendChild(new SimpleText('Unclosed comment'));
        doc.appendChild(err);
        return doc;
      }
      const commentData = xmlString.slice(pos + 4, end);
      current.appendChild(new SimpleComment(commentData));
      pos = end + 3;
      continue;
    }

    // CDATA <![CDATA[ ... ]]>
    if (xmlString.startsWith('<![CDATA[', pos)) {
      const end = xmlString.indexOf(']]>', pos + 9);
      if (end === -1) {
        const err = new SimpleElement('parsererror');
        err.appendChild(new SimpleText('Unclosed CDATA'));
        doc.appendChild(err);
        return doc;
      }
      const cdataText = xmlString.slice(pos + 9, end);
      current.appendChild(new SimpleText(cdataText));
      pos = end + 3;
      continue;
    }

    // Processing Instruction <? ... ?>
    if (xmlString.startsWith('<?', pos)) {
      const end = xmlString.indexOf('?>', pos + 2);
      if (end === -1) {
        const err = new SimpleElement('parsererror');
        err.appendChild(new SimpleText('Unclosed processing instruction'));
        doc.appendChild(err);
        return doc;
      }
      const piContent = xmlString.slice(pos + 2, end).trim();
      const firstSpace = piContent.search(/\s/);
      const target = firstSpace === -1 ? piContent : piContent.slice(0, firstSpace);
      const data = firstSpace === -1 ? '' : piContent.slice(firstSpace + 1).trim();
      current.appendChild(new SimplePI(target, data));
      pos = end + 2;
      continue;
    }

    // DOCTYPE or other <! ... >
    if (xmlString.startsWith('<!', pos)) {
      const end = xmlString.indexOf('>', pos + 2);
      if (end === -1) {
        const err = new SimpleElement('parsererror');
        err.appendChild(new SimpleText('Unclosed directive'));
        doc.appendChild(err);
        return doc;
      }
      pos = end + 1;
      continue;
    }

    // Closing tag </tagName>
    if (xmlString.startsWith('</', pos)) {
      const end = xmlString.indexOf('>', pos + 2);
      if (end === -1) {
        const err = new SimpleElement('parsererror');
        err.appendChild(new SimpleText('Unclosed closing tag'));
        doc.appendChild(err);
        return doc;
      }
      const closeTagName = xmlString.slice(pos + 2, end).trim();
      if (
        current.nodeType === 1 &&
        (current as SimpleElement).tagName.toLowerCase() === closeTagName.toLowerCase()
      ) {
        current = current.parentNode || doc;
      } else {
        const err = new SimpleElement('parsererror');
        err.appendChild(new SimpleText(`Mismatched close tag </${closeTagName}>`));
        doc.appendChild(err);
        return doc;
      }
      pos = end + 1;
      continue;
    }

    // Opening or self-closing tag <tagName attrs... /?>
    const end = xmlString.indexOf('>', pos + 1);
    if (end === -1) {
      const err = new SimpleElement('parsererror');
      err.appendChild(new SimpleText('Unclosed tag'));
      doc.appendChild(err);
      return doc;
    }

    const tagContent = xmlString.slice(pos + 1, end).trim();
    const isSelfClosing = tagContent.endsWith('/');
    const tagBody = isSelfClosing ? tagContent.slice(0, -1).trim() : tagContent;

    // A tag containing nested '<' indicates invalid XML syntax (e.g. <scr<script>ipt>)
    if (tagBody.includes('<')) {
      const err = new SimpleElement('parsererror');
      err.appendChild(new SimpleText('Invalid character < in tag'));
      doc.appendChild(err);
      return doc;
    }

    const firstSpace = tagBody.search(/\s/);
    const tagName = firstSpace === -1 ? tagBody : tagBody.slice(0, firstSpace);
    const attrString = firstSpace === -1 ? '' : tagBody.slice(firstSpace + 1).trim();

    if (!tagName || !/^[a-zA-Z_:][a-zA-Z0-9_.:-]*$/.test(tagName)) {
      const err = new SimpleElement('parsererror');
      err.appendChild(new SimpleText(`Invalid tag name: ${tagName}`));
      doc.appendChild(err);
      return doc;
    }

    const element = new SimpleElement(tagName);

    if (attrString) {
      const attrRegex =
        /([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let m: RegExpExecArray | null;
      while ((m = attrRegex.exec(attrString)) !== null) {
        const attrName = m[1];
        const attrValue =
          m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
        element.setAttribute(attrName, attrValue);
      }
    }

    current.appendChild(element);
    if (!doc.documentElement && current === doc) {
      doc.documentElement = element;
    }

    if (!isSelfClosing) {
      current = element;
    }
    pos = end + 1;
  }

  if (current !== doc) {
    const err = new SimpleElement('parsererror');
    err.appendChild(
      new SimpleText(`Unclosed element <${(current as SimpleElement).tagName}>`)
    );
    doc.appendChild(err);
    return doc;
  }

  return doc;
}

function serializeXmlFallback(node: SimpleNode): string {
  if (!node) return '';
  switch (node.nodeType) {
    case 9:
      return node.childNodes.map(serializeXmlFallback).join('');
    case 1: {
      const elem = node as SimpleElement;
      const attrs: string[] = [];
      for (const [k, v] of elem.attributes.entries()) {
        const escapedVal = String(v)
          .replace(/&/g, '&amp;')
          .replace(/"/g, '&quot;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        attrs.push(`${k}="${escapedVal}"`);
      }
      const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
      if (elem.childNodes.length === 0) {
        return `<${elem.tagName}${attrStr}/>`;
      }
      const childrenStr = elem.childNodes.map(serializeXmlFallback).join('');
      return `<${elem.tagName}${attrStr}>${childrenStr}</${elem.tagName}>`;
    }
    case 3:
      return (node as SimpleText).data;
    case 8:
      return `<!--${(node as SimpleComment).data}-->`;
    case 7: {
      const pi = node as SimplePI;
      return `<?${pi.target} ${pi.data}?>`;
    }
    default:
      return '';
  }
}

/**
 * Lossless SVG Metadata, Comment, and Editor Namespaces Stripper.
 * Uses DOMParser and XMLSerializer to sanitize metadata, RDF, comments,
 * and executable scripts/handlers while strictly preserving shapes, paths, and viewbox.
 */
export function stripSvg(
  buffer: Uint8Array,
  options: StripOptions = {}
): {
  cleanedBuffer: Uint8Array;
  removedSegments: string[];
  bytesSaved: number;
} {
  void options;
  const removedSegments: string[] = [];
  const text = new TextDecoder('utf-8').decode(buffer);

  // Reject DTD/entity declarations to prevent billion-laughs / XXE attacks.
  // This check applies to both the DOMParser browser path and the fallback parser.
  if (/<!DOCTYPE[\s>]/i.test(text) || /<!ENTITY[\s>]/i.test(text)) {
    throw new Error('Unsupported SVG: DTD and entity declarations are not allowed');
  }

  const useBrowserDom =
    typeof DOMParser !== 'undefined' && typeof XMLSerializer !== 'undefined';

  if (useBrowserDom) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');

      // Check for parsererror
      const hasError =
        Boolean(doc.querySelector('parsererror')) ||
        doc.getElementsByTagName('parsererror').length > 0;
      if (hasError) {
        throw new Error('Invalid or malformed SVG: XML parser error');
      }

      // Remove comment nodes
      const iterator = doc.createNodeIterator(doc, NodeFilter.SHOW_COMMENT);
      const comments: Comment[] = [];
      let commentNode = iterator.nextNode();
      while (commentNode) {
        comments.push(commentNode as Comment);
        commentNode = iterator.nextNode();
      }
      if (comments.length > 0) {
        for (const c of comments) {
          c.remove();
        }
        removedSegments.push('SVG Comments & Generator Tags');
      }

      // Remove <metadata>, <rdf:RDF>, <script> elements
      const metadataElements = Array.from(
        doc.querySelectorAll('metadata, *|metadata')
      );
      if (metadataElements.length > 0) {
        for (const el of metadataElements) el.remove();
        removedSegments.push('SVG <metadata> Container');
      }

      const rdfElements = Array.from(doc.querySelectorAll('rdf, *|RDF'));
      if (rdfElements.length > 0) {
        for (const el of rdfElements) el.remove();
        removedSegments.push('RDF Metadata');
      }

      const scriptElements = Array.from(
        doc.querySelectorAll('script, *|script')
      );
      if (scriptElements.length > 0) {
        for (const el of scriptElements) el.remove();
        removedSegments.push('Executable Script Tags');
      }

      // Strip on* event attributes and editor namespaces
      let strippedEditorData = false;
      const allElements = Array.from(doc.querySelectorAll('*'));
      for (const el of allElements) {
        const toRemove: string[] = [];
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          const name = attr.name.toLowerCase();
          if (name.startsWith('on')) {
            toRemove.push(attr.name);
          } else if (
            name.startsWith('xmlns:inkscape') ||
            name.startsWith('xmlns:sodipodi') ||
            name.startsWith('xmlns:adobe') ||
            name.startsWith('xmlns:i') ||
            name.startsWith('xmlns:x') ||
            name.startsWith('xmlns:sketch') ||
            name.startsWith('inkscape:') ||
            name.startsWith('sodipodi:') ||
            name.startsWith('sketch:')
          ) {
            toRemove.push(attr.name);
            strippedEditorData = true;
          }
        }
        for (const name of toRemove) {
          el.removeAttribute(name);
        }
      }

      if (strippedEditorData) {
        removedSegments.push(
          'Editor Specific Namespaces & Attributes (Inkscape/Illustrator)'
        );
      }

      const serializer = new XMLSerializer();
      let cleanedText = serializer.serializeToString(doc);
      // Clean up extra whitespace between attributes
      cleanedText = cleanedText.replace(/\s{2,}/g, ' ');

      const cleanedBuffer = new TextEncoder().encode(cleanedText);
      return {
        cleanedBuffer,
        removedSegments,
        bytesSaved: Math.max(0, buffer.length - cleanedBuffer.length),
      };
    } catch {
      // Fallback to lightweight DOM parser below
    }
  }

  // Node.js / non-browser fallback:
  const doc = parseXmlFallback(text);
  if (doc.querySelector('parsererror')) {
    throw new Error('Invalid or malformed SVG: XML parser error');
  }

  let strippedEditorData = false;

  const walkNodes = (parent: SimpleNode) => {
    for (let i = parent.childNodes.length - 1; i >= 0; i--) {
      const child = parent.childNodes[i];
      if (child.nodeType === 8) {
        // Comment
        child.remove();
        if (!removedSegments.includes('SVG Comments & Generator Tags')) {
          removedSegments.push('SVG Comments & Generator Tags');
        }
      } else if (child.nodeType === 7 && (child as SimplePI).target === 'xpacket') {
        child.remove();
        if (!removedSegments.includes('XMP Packet in SVG')) {
          removedSegments.push('XMP Packet in SVG');
        }
      } else if (child.nodeType === 1) {
        const elem = child as SimpleElement;
        const tag = elem.localName.toLowerCase();
        if (tag === 'metadata') {
          elem.remove();
          if (!removedSegments.includes('SVG <metadata> Container')) {
            removedSegments.push('SVG <metadata> Container');
          }
          continue;
        }
        if (tag === 'rdf') {
          elem.remove();
          if (!removedSegments.includes('RDF Metadata')) {
            removedSegments.push('RDF Metadata');
          }
          continue;
        }
        if (tag === 'script') {
          elem.remove();
          if (!removedSegments.includes('Executable Script Tags')) {
            removedSegments.push('Executable Script Tags');
          }
          continue;
        }

        const toRemove: string[] = [];
        for (const [attrName] of elem.attributes.entries()) {
          const lower = attrName.toLowerCase();
          if (lower.startsWith('on')) {
            toRemove.push(attrName);
          } else if (
            lower.startsWith('xmlns:inkscape') ||
            lower.startsWith('xmlns:sodipodi') ||
            lower.startsWith('xmlns:adobe') ||
            lower.startsWith('xmlns:i') ||
            lower.startsWith('xmlns:x') ||
            lower.startsWith('xmlns:sketch') ||
            lower.startsWith('inkscape:') ||
            lower.startsWith('sodipodi:') ||
            lower.startsWith('sketch:')
          ) {
            toRemove.push(attrName);
            strippedEditorData = true;
          }
        }
        for (const attr of toRemove) {
          elem.removeAttribute(attr);
        }
        walkNodes(elem);
      }
    }
  };

  walkNodes(doc);

  if (strippedEditorData) {
    removedSegments.push(
      'Editor Specific Namespaces & Attributes (Inkscape/Illustrator)'
    );
  }

  let cleanedText = serializeXmlFallback(doc);
  cleanedText = cleanedText.replace(/\s{2,}/g, ' ');
  const cleanedBuffer = new TextEncoder().encode(cleanedText);

  return {
    cleanedBuffer,
    removedSegments,
    bytesSaved: Math.max(0, buffer.length - cleanedBuffer.length),
  };
}
