import { idKey, type CodeSymbol, type SymbolId } from "./types.js";

export class SymbolIndex {
  private readonly byId = new Map<string, CodeSymbol>();
  private readonly byName = new Map<string, CodeSymbol[]>();
  private readonly byFile = new Map<string, CodeSymbol[]>();

  add(symbol: CodeSymbol): void {
    const key = idKey(symbol.id);
    if (this.byId.has(key)) {
      return;
    }
    this.byId.set(key, symbol);

    const names = this.byName.get(symbol.name) ?? [];
    names.push(symbol);
    this.byName.set(symbol.name, names);

    const files = this.byFile.get(symbol.file) ?? [];
    files.push(symbol);
    this.byFile.set(symbol.file, files);
  }

  get(id: SymbolId): CodeSymbol | undefined {
    return this.byId.get(idKey(id));
  }

  findByName(name: string): CodeSymbol[] {
    return this.byName.get(name) ?? [];
  }

  findByFile(file: string): CodeSymbol[] {
    return this.byFile.get(file) ?? [];
  }

  findByQualifiedName(file: string, qualifiedName: string): CodeSymbol | undefined {
    return this.byId.get(idKey({ file, qualifiedName }));
  }

  all(): CodeSymbol[] {
    return [...this.byId.values()];
  }

  size(): number {
    return this.byId.size;
  }
}
