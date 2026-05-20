package net.seasonalfood.app.widget;

import android.content.Context;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/**
 * 위젯 공통 데이터 두뇌 (WidgetDataHelper)
 * -------------------------------------------------
 * - assets 폴더에서 ingredients.json, holidays.json 읽기
 * - 이번 달 제철음식 목록 필터링
 * - 오늘 날짜(일) 기준으로 순환 인덱스 계산
 * - 가장 가까운 명절 계산 (양력 고정 날짜 + 음력 대략 변환)
 */
public class WidgetDataHelper {

    private static final String TAG = "WidgetDataHelper";

    // ────────────── 데이터 모델 ──────────────

    /** 제철음식 1개 */
    public static class SeasonalItem {
        public String name;       // 이름 (예: "완두콩")
        public String category;   // 카테고리 (예: "채소")
        public String emoji;      // 카테고리별 이모지

        public SeasonalItem(String name, String category) {
            this.name = name;
            this.category = category;
            this.emoji = getCategoryEmoji(category);
        }

        private String getCategoryEmoji(String cat) {
            if (cat == null) return "🌿";
            switch (cat) {
                case "채소": return "🥬";
                case "과일": return "🍎";
                case "해산물": return "🐟";
                case "버섯": return "🍄";
                default: return "🌿";
            }
        }
    }

    /** 명절/절기 1개 */
    public static class HolidayItem {
        public String name;       // 이름 (예: "단오")
        public String mainFood;   // 대표음식 (예: "수리취떡")
        public int dDay;          // D-Day (예: 19)
        public String dDayText;   // 표시용 텍스트 (예: "D-19" 또는 "D-Day!")

        public HolidayItem(String name, String mainFood, int dDay) {
            this.name = name;
            this.mainFood = mainFood;
            this.dDay = dDay;
            this.dDayText = (dDay == 0) ? "D-Day!" : "D-" + dDay;
        }
    }

    // ────────────── 제철음식 데이터 ──────────────

    /**
     * 이번 달 제철음식 목록을 가져온다.
     * @param context 안드로이드 컨텍스트
     * @return 이번 달 제철음식 리스트
     */
    public static List<SeasonalItem> getThisMonthIngredients(Context context) {
        List<SeasonalItem> result = new ArrayList<>();
        int currentMonth = Calendar.getInstance().get(Calendar.MONTH) + 1; // 1~12

        try {
            // assets/public/data/ingredients.json 읽기
            String json = readAssetFile(context, "public/data/ingredients.json");
            if (json == null) return result;

            JSONArray array = new JSONArray(json);
            for (int i = 0; i < array.length(); i++) {
                JSONObject item = array.getJSONObject(i);
                JSONArray months = item.optJSONArray("months");
                if (months == null) continue;

                // 이번 달이 months 배열에 포함되어 있는지 확인
                for (int j = 0; j < months.length(); j++) {
                    if (months.getInt(j) == currentMonth) {
                        String name = item.optString("name_ko", "");
                        String category = item.optString("category", "");
                        if (!name.isEmpty()) {
                            result.add(new SeasonalItem(name, category));
                        }
                        break;
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "제철음식 로드 실패: " + e.getMessage());
        }

        return result;
    }

    /**
     * 오늘 기준 순환 인덱스로 제철음식을 N개 뽑아 반환한다.
     * - 예) count=3, 오늘이 5일, 전체 7개 → index=4(5-1=4) → [4],[5],[6] 순환
     *
     * @param context 컨텍스트
     * @param count   보여줄 개수
     * @return 순환 인덱스 적용된 제철음식 리스트 (최대 count개)
     */
    public static List<SeasonalItem> getRotatedIngredients(Context context, int count) {
        List<SeasonalItem> all = getThisMonthIngredients(context);
        List<SeasonalItem> result = new ArrayList<>();

        if (all.isEmpty()) return result;

        int dayOfMonth = Calendar.getInstance().get(Calendar.DAY_OF_MONTH); // 1~31
        int startIndex = (dayOfMonth - 1) % all.size();

        for (int i = 0; i < count; i++) {
            int idx = (startIndex + i) % all.size();
            result.add(all.get(idx));
        }

        return result;
    }

    /**
     * 이번 달 이름 반환 (예: "5월")
     */
    public static String getCurrentMonthLabel() {
        int month = Calendar.getInstance().get(Calendar.MONTH) + 1;
        return month + "월";
    }

    // ────────────── 명절 데이터 ──────────────

    /**
     * 오늘 이후 가장 가까운 명절을 반환한다.
     * - 양력 고정 명절: 한식(4/5) 직접 처리
     * - 음력 명절: 매년 대략적인 양력 날짜 테이블로 계산
     *   (앱과 달리 위젯은 JS 라이브러리를 쓸 수 없어서 사전 계산 테이블 사용)
     *
     * @param context 컨텍스트
     * @return 가장 가까운 명절 정보, 없으면 null
     */
    public static HolidayItem getNextHoliday(Context context) {
        try {
            String json = readAssetFile(context, "public/data/holidays.json");
            if (json == null) return null;

            JSONArray array = new JSONArray(json);
            Calendar today = Calendar.getInstance();
            today.set(Calendar.HOUR_OF_DAY, 0);
            today.set(Calendar.MINUTE, 0);
            today.set(Calendar.SECOND, 0);
            today.set(Calendar.MILLISECOND, 0);

            HolidayItem closest = null;
            int minDays = Integer.MAX_VALUE;

            for (int i = 0; i < array.length(); i++) {
                JSONObject holiday = array.getJSONObject(i);
                String name = holiday.optString("name", "");
                String mainFood = holiday.optString("main_food", "");
                JSONObject dateObj = holiday.optJSONObject("date");
                if (dateObj == null) continue;

                String dateType = dateObj.optString("type", "");
                Calendar holidayCal = getHolidayCalendar(dateType, dateObj, today);
                if (holidayCal == null) continue;

                // 오늘 이후의 명절만 계산
                long diffMs = holidayCal.getTimeInMillis() - today.getTimeInMillis();
                int diffDays = (int) (diffMs / (1000 * 60 * 60 * 24));

                if (diffDays >= 0 && diffDays < minDays) {
                    minDays = diffDays;
                    closest = new HolidayItem(name, mainFood, diffDays);
                }
            }

            return closest;

        } catch (Exception e) {
            Log.e(TAG, "명절 로드 실패: " + e.getMessage());
            return null;
        }
    }

    /**
     * 명절 날짜 타입에 따라 올해/내년 Calendar를 계산한다.
     * - solar: 양력 고정 (한식 등)
     * - lunar: 음력 → 양력 사전 변환 테이블 사용
     * - dynamic: 절기(동지) → 12월 22일 고정
     */
    private static Calendar getHolidayCalendar(String type, JSONObject dateObj, Calendar today) {
        try {
            int currentYear = today.get(Calendar.YEAR);

            if ("solar".equals(type)) {
                // 양력 고정 날짜
                int month = dateObj.getInt("month");
                int day = dateObj.getInt("day");
                Calendar cal = Calendar.getInstance();
                cal.set(currentYear, month - 1, day, 0, 0, 0);
                cal.set(Calendar.MILLISECOND, 0);
                // 이미 지났으면 내년으로
                if (cal.before(today)) {
                    cal.set(currentYear + 1, month - 1, day, 0, 0, 0);
                }
                return cal;

            } else if ("lunar".equals(type)) {
                // 음력 → 양력 변환 테이블 (2026~2027년 주요 명절)
                int lunarMonth = dateObj.getInt("month");
                int lunarDay = dateObj.getInt("day");
                return getLunarToSolar(currentYear, lunarMonth, lunarDay, today);

            } else if ("dynamic".equals(type)) {
                // 동지: 매년 12월 22일 전후 (간단히 12/22로 고정)
                Calendar cal = Calendar.getInstance();
                cal.set(currentYear, 11, 22, 0, 0, 0);
                cal.set(Calendar.MILLISECOND, 0);
                if (cal.before(today)) {
                    cal.set(currentYear + 1, 11, 22, 0, 0, 0);
                }
                return cal;
            }
        } catch (Exception e) {
            Log.e(TAG, "날짜 변환 실패: " + e.getMessage());
        }
        return null;
    }

    /**
     * 음력 → 양력 변환 사전 테이블
     * ※ JS 라이브러리를 사용할 수 없는 위젯 환경을 위해
     *   2026~2028년 주요 명절의 양력 날짜를 직접 계산하여 하드코딩
     *
     * 음력 날짜: 양력 변환 기준
     *   설날(음1/1):       2026-02-17, 2027-02-06, 2028-01-26
     *   정월대보름(음1/15): 2026-03-03, 2027-02-20, 2028-02-09
     *   삼짇날(음3/3):     2026-04-20, 2027-04-09, 2028-03-29
     *   단오(음5/5):       2026-06-19, 2027-06-09, 2028-05-28
     *   유두(음6/15):      2026-07-30, 2027-07-19, 2028-07-08
     *   칠석(음7/7):       2026-08-20, 2027-08-09, 2028-07-29
     *   백중(음7/15):      2026-08-28, 2027-08-17, 2028-08-06
     *   추석(음8/15):      2026-09-25, 2027-09-15, 2028-10-03
     *   중양절(음9/9):     2026-10-19, 2027-10-08, 2028-09-27
     */
    private static Calendar getLunarToSolar(int year, int lunarMonth, int lunarDay, Calendar today) {
        // [lunarMonth][lunarDay] → {year, solarMonth(1-12), solarDay}
        int[][] dates2026 = getKoreanHolidayDates(2026, lunarMonth, lunarDay);
        int[][] dates2027 = getKoreanHolidayDates(2027, lunarMonth, lunarDay);
        int[][] dates2028 = getKoreanHolidayDates(2028, lunarMonth, lunarDay);

        // 올해 날짜 먼저 시도
        Calendar cal = toCalendar(getKoreanHolidayDates(year, lunarMonth, lunarDay));
        if (cal != null && !cal.before(today)) return cal;

        // 다음 해 날짜
        cal = toCalendar(getKoreanHolidayDates(year + 1, lunarMonth, lunarDay));
        if (cal != null && !cal.before(today)) return cal;

        // 그 다음 해
        cal = toCalendar(getKoreanHolidayDates(year + 2, lunarMonth, lunarDay));
        return cal;
    }

    /**
     * 연도 + 음력 월/일 → 양력 [월, 일] 반환 테이블
     * 없으면 null 반환
     */
    private static int[][] getKoreanHolidayDates(int year, int lunarMonth, int lunarDay) {
        // 반환 형식: {{solarMonth, solarDay}} (1-indexed month)
        if (year == 2026) {
            if (lunarMonth == 1 && lunarDay == 1)  return new int[][]{{2, 17}};
            if (lunarMonth == 1 && lunarDay == 15) return new int[][]{{3, 3}};
            if (lunarMonth == 3 && lunarDay == 3)  return new int[][]{{4, 20}};
            if (lunarMonth == 5 && lunarDay == 5)  return new int[][]{{6, 19}};
            if (lunarMonth == 6 && lunarDay == 15) return new int[][]{{7, 30}};
            if (lunarMonth == 7 && lunarDay == 7)  return new int[][]{{8, 20}};
            if (lunarMonth == 7 && lunarDay == 15) return new int[][]{{8, 28}};
            if (lunarMonth == 8 && lunarDay == 15) return new int[][]{{9, 25}};
            if (lunarMonth == 9 && lunarDay == 9)  return new int[][]{{10, 19}};
        } else if (year == 2027) {
            if (lunarMonth == 1 && lunarDay == 1)  return new int[][]{{2, 6}};
            if (lunarMonth == 1 && lunarDay == 15) return new int[][]{{2, 20}};
            if (lunarMonth == 3 && lunarDay == 3)  return new int[][]{{4, 9}};
            if (lunarMonth == 5 && lunarDay == 5)  return new int[][]{{6, 9}};
            if (lunarMonth == 6 && lunarDay == 15) return new int[][]{{7, 19}};
            if (lunarMonth == 7 && lunarDay == 7)  return new int[][]{{8, 9}};
            if (lunarMonth == 7 && lunarDay == 15) return new int[][]{{8, 17}};
            if (lunarMonth == 8 && lunarDay == 15) return new int[][]{{9, 15}};
            if (lunarMonth == 9 && lunarDay == 9)  return new int[][]{{10, 8}};
        } else if (year == 2028) {
            if (lunarMonth == 1 && lunarDay == 1)  return new int[][]{{1, 26}};
            if (lunarMonth == 1 && lunarDay == 15) return new int[][]{{2, 9}};
            if (lunarMonth == 3 && lunarDay == 3)  return new int[][]{{3, 29}};
            if (lunarMonth == 5 && lunarDay == 5)  return new int[][]{{5, 28}};
            if (lunarMonth == 6 && lunarDay == 15) return new int[][]{{7, 8}};
            if (lunarMonth == 7 && lunarDay == 7)  return new int[][]{{7, 29}};
            if (lunarMonth == 7 && lunarDay == 15) return new int[][]{{8, 6}};
            if (lunarMonth == 8 && lunarDay == 15) return new int[][]{{10, 3}};
            if (lunarMonth == 9 && lunarDay == 9)  return new int[][]{{9, 27}};
        }
        return null;
    }

    private static Calendar toCalendar(int[][] monthDay) {
        if (monthDay == null || monthDay.length == 0) return null;
        // 연도는 현재 연도로 세팅 (getLunarToSolar에서 year 파라미터로 제어)
        // 이 메서드는 단순히 {month, day} 배열을 받아 올해 Calendar로 변환
        // → getLunarToSolar에서 이미 year별로 호출하므로 현재 연도 사용
        Calendar cal = Calendar.getInstance();
        cal.set(cal.get(Calendar.YEAR), monthDay[0][0] - 1, monthDay[0][1], 0, 0, 0);
        cal.set(Calendar.MILLISECOND, 0);
        return cal;
    }

    // ────────────── 파일 유틸 ──────────────

    /**
     * assets 폴더에서 텍스트 파일을 읽어 문자열로 반환한다.
     * @param path assets 내 경로 (예: "public/data/ingredients.json")
     */
    private static String readAssetFile(Context context, String path) {
        try {
            InputStream is = context.getAssets().open(path);
            byte[] buffer = new byte[is.available()];
            is.read(buffer);
            is.close();
            return new String(buffer, StandardCharsets.UTF_8);
        } catch (Exception e) {
            Log.e(TAG, "파일 읽기 실패 [" + path + "]: " + e.getMessage());
            return null;
        }
    }
}
