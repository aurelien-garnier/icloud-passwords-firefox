import { Route, Routes } from "react-router-dom";
import { useReady } from "../shared/hooks/use-ready";
import { ChallengeView } from "./challenge";
import { HomeView } from "./home";
import { PasswordsView } from "./passwords";
import { OneTimeCodesView } from "./one-time-codes";
import { GeneratorView } from "./generator";
import { LoadingView } from "../shared/loading";
import { ErrorView } from "../shared/error";

export function PopupView() {
  const { ready, error, refetch } = useReady();

  if (error !== undefined) return <ErrorView error={error} />;
  if (ready === undefined) return <LoadingView action="IS_READY" />;

  return (
    <>
      {ready ? (
        <Routes>
          <Route Component={HomeView}>
            <Route index Component={PasswordsView} />
            <Route path="/otc" Component={OneTimeCodesView} />
          </Route>
          <Route path="/generate" Component={GeneratorView} />
        </Routes>
      ) : (
        <ChallengeView setReady={() => refetch()} />
      )}
    </>
  );
}
