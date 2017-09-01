interface IHelpable {
    getHelp(): HelpDefinition;
}

class HelpDefinition {
}

class EmbedDefinition {
    title?: string;
    url?: string;
    description?: string;
    footer?: string;
    color?: number
    fields?: { name: string, value: string }[];
}