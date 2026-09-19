import { type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import LandingPage from '@/pages/landing';
import HomePage from '@/pages/home';
import StudySetPage from '@/pages/study-set';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#b63d36',
    colorForeground: '#252944',
    colorMutedForeground: '#686a78',
    colorBackground: '#fbf4e4',
    colorInput: '#fffaf0',
    colorInputForeground: '#252944',
    colorNeutral: '#d9cdb7',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf4e4] border-2 border-[#252944] rounded-3xl w-[440px] max-w-full overflow-hidden shadow-[6px_6px_0_#252944]',
    card: '!shadow-none !border-0 !bg-transparent',
    footer: '!shadow-none !border-0 !bg-transparent',
    headerTitle: 'font-serif text-3xl font-bold text-[#252944]',
    headerSubtitle: 'text-[#686a78]',
    formFieldLabel: 'font-bold text-[#252944]',
    formFieldInput: 'bg-[#fffaf0] border-[#d9cdb7] text-[#252944] rounded-xl',
    formButtonPrimary: 'bg-[#b63d36] hover:bg-[#9f332e] rounded-xl font-bold',
    socialButtonsBlockButton: 'border-2 border-[#d9cdb7] bg-[#fffaf0] rounded-xl',
    socialButtonsBlockButtonText: 'font-bold text-[#252944]',
    footerActionLink: 'text-[#b63d36] font-bold',
    footerActionText: 'text-[#686a78]',
    dividerText: 'text-[#686a78]',
    dividerLine: 'bg-[#d9cdb7]',
    logoBox: 'h-12',
  },
};

function AuthSplash() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background"><div className="h-10 w-10 animate-pulse rounded-full bg-primary" /></div>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthSplash />;
  return isSignedIn ? <Redirect to="/home" /> : <LandingPage />;
}

function PrivateRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthSplash />;
  return isSignedIn ? <>{children}</> : <Redirect to="/" />;
}

function SignInPage() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background px-4 py-8"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={clerkAppearance} /></div>;
}

function SignUpPage() {
  return <div className="grid min-h-[100dvh] place-items-center bg-background px-4 py-8"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} appearance={clerkAppearance} /></div>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/home"><PrivateRoute><HomePage /></PrivateRoute></Route>
        <Route path="/study-sets/:studySetId"><PrivateRoute><StudySetPage /></PrivateRoute></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{ signIn: { start: { title: "Welcome back", subtitle: "Return to your reading room" } }, signUp: { start: { title: "Make your reading room", subtitle: "A private place for your next big idea" } } }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
