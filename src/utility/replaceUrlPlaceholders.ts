const replacePlaceholders = (url: string): string => {
    // match it against multiple regexes and replace with the right placeholder as per the openapi spec

    // first for member expression
    const memberExpressionRegex = /\[MemberExpression -> (.*?)\]/g;
    const memberExpressionMatches = url.matchAll(memberExpressionRegex);
    for (const match of memberExpressionMatches) {
        url = url.replace(match[0], "{" + match[1] + "}");
    }

    // second goes `[var a]`
    const varRegex = /\[var (.*?)\]/g;
    const varMatches = url.matchAll(varRegex);
    for (const match of varMatches) {
        url = url.replace(match[0], "{" + match[1] + "}");
    }

    // `[unresolved member expression]` is a bit tricky, so
    // will replace with `{unres_mem_exp_<appearance_count_like_1_and_2_in_case_found_multiple_times>}`
    const unresolvedMemberExpressionRegex = /\[unresolved member expression\]/g;
    const unresolvedMemberExpressionMatches = url.matchAll(unresolvedMemberExpressionRegex);
    let appearanceCount = 1;
    for (const match of unresolvedMemberExpressionMatches) {
        url = url.replace(match[0], "{unres_mem_exp_" + appearanceCount + "}");
        appearanceCount++;
    }

    // `[unresolved: a]` can't escape as well
    const unresolvedRegex = /\[unresolved: (.*?)\]/g;
    const unresolvedMatches = url.matchAll(unresolvedRegex);
    for (const match of unresolvedMatches) {
        url = url.replace(match[0], "{" + match[1] + "}");
    }

    return url;
};

export default replacePlaceholders;