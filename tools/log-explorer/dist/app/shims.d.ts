// React
declare module 'react' {
  export type Key = string | number;

  export interface ReactElement {
    readonly type: unknown;
    readonly props: unknown;
    readonly key: Key | null;
  }

  export type ReactNode =
    | ReactElement
    | string
    | number
    | bigint
    | boolean
    | null
    | undefined
    | Iterable<ReactNode>;

  export interface RefObject<T> { current: T }
  export type RefCallback<T> = (instance: T | null) => void | (() => void);
  export type Ref<T> = RefObject<T | null> | RefCallback<T> | null;

  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((previous: S) => S);
  export type DependencyList = readonly unknown[];
  export type EffectCallback = () => void | (() => void);
  export type AnyFunction = (...args: never[]) => unknown;

  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S): [S, Dispatch<A>];
  export function useReducer<S, A, I>(reducer: (state: S, action: A) => S, initialArg: I, init: (arg: I) => S): [S, Dispatch<A>];
  export function useRef<T>(initial: T): RefObject<T>;
  export function useRef<T>(initial: T | null): RefObject<T | null>;
  export function useEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useLayoutEffect(effect: EffectCallback, deps?: DependencyList): void;
  export function useMemo<T>(factory: () => T, deps: DependencyList): T;
  export function useCallback<T extends AnyFunction>(callback: T, deps: DependencyList): T;
  export function useEffectEvent<T extends AnyFunction>(callback: T): T;

  export interface Context<T> {
    (props: { readonly value: T; readonly children?: ReactNode }): ReactNode;
    readonly displayName?: string;
  }
  export function createContext<T>(defaultValue: T): Context<T>;
  export function use<T>(context: Context<T>): T;
  export function use<T>(promise: Promise<T>): T;

  export interface SyntheticEvent<T = Element, E = Event> {
    readonly nativeEvent: E;
    readonly currentTarget: T;
    readonly target: T;
    preventDefault(): void;
    stopPropagation(): void;
  }

  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T, globalThis.KeyboardEvent> {
    readonly key: string;
    readonly shiftKey: boolean;
    readonly ctrlKey: boolean;
    readonly metaKey: boolean;
    readonly altKey: boolean;
  }

  export interface MouseEvent<T = Element, E = globalThis.MouseEvent> extends SyntheticEvent<T, E> {
    readonly clientX: number;
    readonly clientY: number;
  }

  export type PointerEvent<T = Element> = MouseEvent<T, globalThis.PointerEvent>;
  export type ChangeEvent<T = Element> = SyntheticEvent<T>;
  export type FocusEvent<T = Element> = SyntheticEvent<T, globalThis.FocusEvent>;
  export type FormEvent<T = Element> = SyntheticEvent<T>;
  export type UIEvent<T = Element> = SyntheticEvent<T, globalThis.UIEvent>;

  export type CSSProperties = Readonly<Record<string, string | number>>;

  export interface DOMAttributes<T> {
    readonly [attribute: string]: unknown;
    readonly children?: ReactNode;
    readonly key?: Key;
    readonly ref?: Ref<T>;
    readonly className?: string;
    readonly id?: string;
    readonly style?: CSSProperties;
    readonly onClick?: (event: MouseEvent<T>) => void;
    readonly onMouseDown?: (event: MouseEvent<T>) => void;
    readonly onPointerMove?: (event: PointerEvent<T>) => void;
    readonly onPointerEnter?: (event: PointerEvent<T>) => void;
    readonly onPointerLeave?: (event: PointerEvent<T>) => void;
    readonly onKeyDown?: (event: KeyboardEvent<T>) => void;
    readonly onChange?: (event: ChangeEvent<T>) => void;
    readonly onScroll?: (event: UIEvent<T>) => void;
    readonly onSubmit?: (event: FormEvent<T>) => void;
    readonly onFocus?: (event: FocusEvent<T>) => void;
    readonly onBlur?: (event: FocusEvent<T>) => void;
  }
}

// React JSX runtime (used by "jsx": "react-jsx")
declare module 'react/jsx-runtime' {
  import type { DOMAttributes, Key, ReactElement, ReactNode } from 'react';

  type HtmlTags = { [K in keyof HTMLElementTagNameMap]: DOMAttributes<HTMLElementTagNameMap[K]> };
  type SvgTags = { [K in Exclude<keyof SVGElementTagNameMap, keyof HTMLElementTagNameMap>]: DOMAttributes<SVGElementTagNameMap[K]> };

  export namespace JSX {
    type Element = ReactElement;
    type ElementType = string | ((props: never) => ReactNode);
    interface ElementChildrenAttribute { children: unknown }
    interface IntrinsicAttributes { key?: Key }
    interface IntrinsicElements extends HtmlTags, SvgTags {}
  }

  export const Fragment: symbol;
  export function jsx(type: unknown, props: unknown, key?: Key): ReactElement;
  export function jsxs(type: unknown, props: unknown, key?: Key): ReactElement;
}

// React DOM
declare module 'react-dom/client' {
  import type { ReactNode } from 'react';

  export interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }

  export function createRoot(container: Element | DocumentFragment): Root;
}

// D3
declare module 'd3' {
  export interface ScaleTime {
    (value: Date | number): number;
    domain(domain: ReadonlyArray<Date | number>): this;
    range(range: readonly number[]): this;
    invert(value: number): Date;
    ticks(count?: number): Date[];
  }

  export interface ScaleLinear {
    (value: number): number;
    domain(domain: readonly number[]): this;
    range(range: readonly number[]): this;
    nice(): this;
    ticks(count?: number): number[];
  }

  export interface Line<D> {
    (data: Iterable<D>): string | null;
    defined(test: (d: D, index: number) => boolean): this;
    x(accessor: (d: D, index: number) => number): this;
    y(accessor: (d: D, index: number) => number): this;
  }

  export interface Selection<E extends Element> {
    call<A extends unknown[]>(fn: (selection: Selection<E>, ...args: A) => void, ...args: A): this;
    on(typenames: string, listener: null): this;
    selectAll(selector: string): Selection<Element>;
    remove(): this;
  }

  export interface D3BrushEvent<Datum> {
    readonly type: string;
    readonly selection: [number, number] | null;
    readonly sourceEvent: Event | undefined;
    readonly target: BrushBehavior<Datum>;
  }

  export interface BrushBehavior<Datum> {
    (selection: Selection<SVGGElement>): void;
    extent(extent: [[number, number], [number, number]]): this;
    on(typenames: string, listener: (event: D3BrushEvent<Datum>) => void): this;
    move(selection: Selection<SVGGElement>, extent: [number, number] | null): void;
  }

  export function scaleUtc(): ScaleTime;
  export function scaleTime(): ScaleTime;
  export function scaleLinear(): ScaleLinear;
  export function line<D>(): Line<D>;
  export function select<E extends Element>(node: E): Selection<E>;
  export function brushX<Datum>(): BrushBehavior<Datum>;
  export function pointer(event: { readonly clientX: number; readonly clientY: number }, target?: Element | null): [number, number];
  export function bisectCenter(values: ArrayLike<number>, x: number): number;
  export function max<T>(values: Iterable<T>, accessor: (d: T) => number | null | undefined): number | undefined;
  export function max(values: Iterable<number | null | undefined>): number | undefined;
}

// GSAP
declare module 'gsap' {
  export interface TweenVars {
    readonly [property: string]: unknown;
    readonly duration?: number;
    readonly ease?: string;
  }

  export interface Tween { kill(): void }

  export interface Context { readonly conditions?: Readonly<Record<string, boolean>> }

  export interface MatchMedia {
    add(queries: Readonly<Record<string, string>>, setup: (context: Context) => void | (() => void)): this;
    revert(): void;
  }

  export interface Gsap {
    from(target: Element, vars: TweenVars): Tween;
    fromTo(target: Element, fromVars: TweenVars, toVars: TweenVars): Tween;
    matchMedia(): MatchMedia;
  }

  export const gsap: Gsap;
  export default gsap;
}

// TanStack Query
declare module '@tanstack/react-query' {
  import type { ReactNode } from 'react';

  export type QueryKey = readonly unknown[];

  export interface QueryFunctionContext { readonly signal: AbortSignal; readonly queryKey: QueryKey }

  export interface Query { readonly queryKey: QueryKey }

  export interface QueryOptions<T> {
    readonly queryKey: QueryKey;
    readonly queryFn: (context: QueryFunctionContext) => Promise<T>;
    readonly enabled?: boolean;
    readonly staleTime?: number;
    readonly gcTime?: number;
    readonly retry?: boolean | number;
    readonly placeholderData?: (previous: T | undefined) => T | undefined;
  }

  export interface UseQueryResult<T> {
    readonly data: T | undefined;
    readonly error: Error | null;
    readonly status: 'pending' | 'error' | 'success';
    readonly isPending: boolean;
    readonly isError: boolean;
    readonly isSuccess: boolean;
    readonly isFetching: boolean;
    readonly isPlaceholderData: boolean;
    refetch(): Promise<unknown>;
  }

  export interface MutationOptions<T, V> {
    readonly mutationFn: (variables: V) => Promise<T>;
    readonly onSuccess?: (data: T, variables: V) => unknown;
    readonly onError?: (error: Error, variables: V) => unknown;
  }

  export interface UseMutationResult<T, V> {
    mutate(variables: V, options?: { onSuccess?: (data: T) => void; onError?: (error: Error) => void }): void;
    mutateAsync(variables: V): Promise<T>;
    readonly isPending: boolean;
    readonly error: Error | null;
    reset(): void;
  }

  export interface DefaultOptions {
    readonly queries?: { readonly refetchOnWindowFocus?: boolean; readonly retry?: boolean | number; readonly staleTime?: number };
  }

  export class QueryClient {
    constructor(config?: { readonly defaultOptions?: DefaultOptions });
    fetchQuery<T>(options: QueryOptions<T>): Promise<T>;
    getQueryData<T>(queryKey: QueryKey): T | undefined;
    setQueryData<T>(queryKey: QueryKey, data: T): T | undefined;
    invalidateQueries(filters?: { readonly queryKey?: QueryKey; readonly predicate?: (query: Query) => boolean }): Promise<void>;
  }

  export function QueryClientProvider(props: { readonly client: QueryClient; readonly children?: ReactNode }): ReactNode;
  export function useQueryClient(): QueryClient;
  export function useQuery<T>(options: QueryOptions<T>): UseQueryResult<T>;
  export function useMutation<T, V>(options: MutationOptions<T, V>): UseMutationResult<T, V>;
  export function keepPreviousData<T>(previous: T | undefined): T | undefined;
}
