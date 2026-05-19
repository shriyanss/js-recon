export interface Rule {
    id: string;
    name: string;
    author: string;
    description: string;
    js_recon_version: string;
    tech: ("next" | "all")[];
    severity: "info" | "low" | "medium" | "high";
    type: "request" | "ast";
    steps: Step[];
}

export type Step = {
    name: string;
    message: string;
    requires?: string[];
    request?: RequestStep; // used for openapi
    esquery?: EsqueryStep; // parse an esquery string
    postMessageFuncResolve?: PostMessageFuncResolverStep; // get the second argument of the addEventListener("message", ...) call expression
    checkAssignmentExist?: CheckAssignmentExistStep; // check if a function exists in the node
};

export type RequestStep =
    | {
          type: "headers";
          condition: "contains" | "absent";
          name: string;
      }
    | {
          type: "url";
          condition: "contains" | "absent";
          name: string;
      }
    | {
          type: "method";
          condition: "is" | "is_not";
          name: string;
      };

export type EsqueryStep = {
    type: "esquery";
    query: string;
    // optional: scope the esquery to the subtree rooted at a previously matched step's node.
    // when set, esquery runs against `matchList[<name>].node` instead of the whole chunk AST.
    inScopeOf?: string;
    // optional: require the matched node to actually consume a value tainted from the
    // matches of the named source step (data-flow check). When set, esquery matches
    // are filtered to only those whose value-side subtree references a tainted
    // binding/member-chain or directly contains a source subtree.
    taintFrom?: string;
};

export type PostMessageFuncResolverStep = {
    name: string;
};

export type CheckAssignmentExistStep = {
    name: string;
    type: string;
    memberExpression?: boolean;
};
