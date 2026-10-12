import { lazy, Suspense, useEffect } from 'react';
import { useSettings } from './hooks/useSettings';
import { useRoute, type RouteId } from './router';
import { TodayScreen } from './screens/today/TodayScreen';
import { CrashProbe, ScreenBoundary } from './shell/ErrorBoundary';
import { Snowfall } from './shell/Snowfall';
import { TabBar } from './shell/TabBar';
import { UpdatePrompt } from './shell/UpdatePrompt';
import { OverlayProvider } from './ui/OverlayProvider';

const TrainingScreen = lazy(() => import('./screens/training/TrainingScreen'));
const SchoolScreen = lazy(() => import('./screens/school/SchoolScreen'));
const BodyScreen = lazy(() => import('./screens/body/BodyScreen'));
const ReviewScreen = lazy(() => import('./screens/review/ReviewScreen'));
const HabitsScreen = lazy(() => import('./screens/habits/HabitsScreen'));
const SettingsScreen = lazy(() => import('./screens/settings/SettingsScreen'));

const TITLES: Record<RouteId, string> = {
  heute: 'Heute',
  training: 'Training',
  schule: 'Schule',
  koerper: 'Körper',
  rueckblick: 'Rückblick',
  habits: 'Habits',
  einstellungen: 'Einstellungen',
};

export function App() {
  const route = useRoute();
  const settings = useSettings();

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = `${TITLES[route.id]} · Winter`;
  }, [route.id]);

  return (
    <OverlayProvider>
      <Snowfall enabled={settings.snow} />
      <UpdatePrompt />
      <main className="app">
        <ScreenBoundary key={route.id} name={route.id}>
          <Suspense fallback={<div className="screen" style={{ minHeight: '100dvh' }} />}>
            <div className="route-fade">
              <CrashProbe name={route.id} />
              {route.id === 'heute' && <TodayScreen date={route.param} />}
              {route.id === 'training' && <TrainingScreen />}
              {route.id === 'schule' && <SchoolScreen />}
              {route.id === 'koerper' && <BodyScreen />}
              {route.id === 'rueckblick' && <ReviewScreen />}
              {route.id === 'habits' && <HabitsScreen />}
              {route.id === 'einstellungen' && <SettingsScreen />}
            </div>
          </Suspense>
        </ScreenBoundary>
      </main>
      <TabBar active={route.id} />
    </OverlayProvider>
  );
}
