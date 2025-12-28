import { runAgentPipeline } from '../agents/agentOrchestrator';

async function test() {
  const longDesc = `أريد إنشاء بوت متكامل لإدارة عيادة طبية يتضمن الميزات التالية:
  1. حجز المواعيد مع الأطباء المختلفين
  2. عرض قائمة الأطباء وتخصصاتهم ومواعيد عملهم
  3. إرسال تذكيرات للمرضى قبل المواعيد
  4. استعراض الملف الطبي للمريض
  5. طلب تقارير طبية
  6. الدفع الإلكتروني للفواتير
  7. التواصل المباشر مع الطبيب عبر الرسائل
  8. حالات الطوارئ والاتصال السريع
  9. تقييم الخدمة بعد الزيارة
  10. عرض العروض والخصومات الحالية
  يجب أن يكون البوت سهل الاستخدام ويدعم اللغة العربية بشكل كامل`;
  
  const result = await runAgentPipeline({
    traceId: 'smoke-2',
    userId: 'test-user',
    chatId: 123,
    messageText: longDesc,
    sessionState: 'AWAITING_DESCRIPTION'
  });
  console.log('Test 2 - Long prompt:', result.ok ? 'PASS' : 'FAIL');
  if (result.ok) {
    console.log('Menu items:', result.blueprint.menu.length);
    console.log('Name:', result.blueprint.name);
  } else {
    console.log('Error:', result.errorMessage);
  }
}
test();
