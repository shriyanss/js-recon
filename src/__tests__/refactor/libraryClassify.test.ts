import { describe, it, expect } from "vitest";
import {
    librarySource,
    REACT_CANONICAL,
    JSX_RUNTIME_CANONICAL,
    REACT_DOM_CLIENT_CANONICAL,
    REACT_ROUTER_DOM_CANONICAL,
} from "../../refactor/react/library-classify.js";

describe("librarySource", () => {
    it("maps 'react' to the react package", () => {
        expect(librarySource("react")).toBe("react");
    });

    it("maps 'react-dom-client' to 'react-dom/client'", () => {
        expect(librarySource("react-dom-client")).toBe("react-dom/client");
    });

    it("maps 'react-jsx-runtime' to 'react/jsx-runtime'", () => {
        expect(librarySource("react-jsx-runtime")).toBe("react/jsx-runtime");
    });

    it("maps 'react-router-dom' to the react-router-dom package", () => {
        expect(librarySource("react-router-dom")).toBe("react-router-dom");
    });

    it("maps 'unknown' to an empty string", () => {
        expect(librarySource("unknown")).toBe("");
    });

    it("maps 'style-loader' to an empty string", () => {
        expect(librarySource("style-loader")).toBe("");
    });
});

describe("REACT_CANONICAL", () => {
    it("includes core hooks", () => {
        expect(REACT_CANONICAL.has("useState")).toBe(true);
        expect(REACT_CANONICAL.has("useEffect")).toBe(true);
        expect(REACT_CANONICAL.has("useRef")).toBe(true);
    });

    it("includes createElement and Fragment", () => {
        expect(REACT_CANONICAL.has("createElement")).toBe(true);
        expect(REACT_CANONICAL.has("Fragment")).toBe(true);
    });

    it("does not include react-dom-client exports", () => {
        expect(REACT_CANONICAL.has("createRoot")).toBe(false);
        expect(REACT_CANONICAL.has("hydrateRoot")).toBe(false);
    });
});

describe("JSX_RUNTIME_CANONICAL", () => {
    it("includes jsx and jsxs", () => {
        expect(JSX_RUNTIME_CANONICAL.has("jsx")).toBe(true);
        expect(JSX_RUNTIME_CANONICAL.has("jsxs")).toBe(true);
    });

    it("deliberately excludes Fragment (shared with React module)", () => {
        expect(JSX_RUNTIME_CANONICAL.has("Fragment")).toBe(false);
    });
});

describe("REACT_DOM_CLIENT_CANONICAL", () => {
    it("includes createRoot and hydrateRoot", () => {
        expect(REACT_DOM_CLIENT_CANONICAL.has("createRoot")).toBe(true);
        expect(REACT_DOM_CLIENT_CANONICAL.has("hydrateRoot")).toBe(true);
    });
});

describe("REACT_ROUTER_DOM_CANONICAL", () => {
    it("includes hooks", () => {
        expect(REACT_ROUTER_DOM_CANONICAL.has("useNavigate")).toBe(true);
        expect(REACT_ROUTER_DOM_CANONICAL.has("useLocation")).toBe(true);
        expect(REACT_ROUTER_DOM_CANONICAL.has("useParams")).toBe(true);
    });

    it("includes components", () => {
        expect(REACT_ROUTER_DOM_CANONICAL.has("Route")).toBe(true);
        expect(REACT_ROUTER_DOM_CANONICAL.has("Link")).toBe(true);
        expect(REACT_ROUTER_DOM_CANONICAL.has("BrowserRouter")).toBe(true);
    });
});
