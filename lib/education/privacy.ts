export const ADMINISTRATION_ACCESS_VERSION = 1;
export const COURSE_ADMINISTRATION_NOTICE = "课程教师及课程负责人配置的研究管理人员可以查看全班已保存的教学记录，用于课程核查、教学质量检查与平台管理。此管理视图包括未同意或已退出研究的学生记录，查看操作会留痕。管理查看不等于研究参与同意，不能将这些记录自动当作研究样本；授权研究资料与研究导出仍单独检查学生当前有效的自愿选择。";
export function withCourseAdministrationNotice(notice: string) {
  return notice.includes(COURSE_ADMINISTRATION_NOTICE) ? notice : `${notice}\n\n${COURSE_ADMINISTRATION_NOTICE}`;
}
// Draft only: the teacher must supply real contact/retention arrangements and review it.
export const TEACHING_NOTICE_DRAFT = withCourseAdministrationNotice("本课程学习空间用于教育心理学教学支持，会按固定学生 ID 保存各阶段回答、提示使用、答疑对话、时间与教师反馈。系统不会仅凭使用次数评定认知能力或给分。请不要填写真实第三方姓名、联系方式、具体成绩或敏感经历。学习答疑由智能辅助生成，可能存在错误，不是教师本人回复，请对照讲义核查。答疑仅在解释与修订阶段开放，会将相关任务材料、近期对话和问题发送给指定服务商处理；目前由深度求索提供。自动遮蔽部分联系方式不等于匿名化。课程网站由托管服务提供，身份验证及教学记录存放在独立课程数据库，当前数据库位于新加坡，服务基础设施可能位于中国大陆以外；请由课程负责人确认学校的数据使用要求。教学记录的保存与到期处理安排、联系渠道见下方教师填写内容。研究参与是单独的自愿选择，不作为课程参与或成绩条件；正式研究使用默认关闭，未同意当前研究告知的记录不会进入授权研究资料或研究导出。");
