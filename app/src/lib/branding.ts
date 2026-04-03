/**
 * Branding — 프로젝트 이름/식별자를 한 곳에서 관리
 *
 * 새 프로젝트에서 이 파일만 수정하면 전체 앱 텍스트가 변경됩니다.
 * 빌드 시 VITE_APP_NAME 환경변수로도 오버라이드 가능.
 */

export const APP_NAME = import.meta.env.VITE_APP_NAME || "DeepCoWork";
export const APP_ID = import.meta.env.VITE_APP_ID || "com.deepcowork.app";
export const APP_SUBTITLE = import.meta.env.VITE_APP_SUBTITLE || "";
export const WINDOW_TITLE = import.meta.env.VITE_WINDOW_TITLE || APP_NAME;
