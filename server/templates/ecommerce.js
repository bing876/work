// 行业指导配置·电商版 v1(后台只读,用户侧不选模板)。
// 用途:供模型判断用户所处经营阶段、决定问什么、能交付什么。只做参考,不强制任何人进上架流程。
// 规则:用户话题与电商经营无关时忽略本模板;用户数据永不回写到模板。
export const ECOMMERCE_GUIDE = {
  id: 'ecommerce',
  version: 1,
  whenToUse: '用户话题涉及卖货、开店、选品、流量、转化、复购等电商经营事项时参考;否则忽略',
  stages: [
    {
      id: 'exploring',
      name: '想法探索期',
      signals: ['想做生意但没定方向', '问某个类目能不能做', '没货源、没经验', '还在上班想找副业'],
      keyQuestions: ['你现在是有货源/供应链，还是还在找产品?', '你每天能投入多少时间，启动资金大概什么范围?'],
      mustNot: ['不追问具体商品规格', '不默认用户要开网店', '不直接给上架文案'],
    },
    {
      id: 'starting',
      name: '筹备起步期',
      signals: ['已定方向或已有货源', '问开店流程、保证金、选平台', '要准备商品资料'],
      keyQuestions: ['你打算先从哪个平台开始?为什么选它?', '首批准备上架几个商品?货源是否稳定?'],
      mustNot: ['一次只问一两个真问题', '用户不知道答案时给选项和取舍，不要卡住'],
    },
    {
      id: 'operating',
      name: '日常经营期',
      signals: ['店已开，有订单或流量问题', '要优化标题、详情、客服话术', '问投流、活动、复购'],
      keyQuestions: ['最近30天大概多少访客、多少订单?转化卡在哪一步?', '你现在最想先解决的一个问题是什么?'],
      mustNot: ['不编造行业平均数据', '没有用户真实数据时只给诊断思路，不下结论'],
    },
    {
      id: 'struggling',
      name: '经营遇困期',
      signals: ['开了几个月没订单', '流量掉了、亏损', '想关店或换方向'],
      keyQuestions: ['店铺开了多久?之前有过订单吗，什么时候开始变差的?', '现在每天大概多少访客?主要流量来源是什么?'],
      mustNot: ['不默认重新生成商品标题', '先诊断再给方案，不跳过问诊直接开药'],
    },
  ],
  deliverables: [
    { id: 'startup-path', name: '起步路径分析', forStages: ['exploring', 'starting'], needs: ['大方向', '时间与资金范围'] },
    { id: 'product-profile', name: '商品资料表', forStages: ['starting', 'operating'], needs: ['具体商品', '价格带', '目标客户', '销售渠道'] },
    { id: 'listing-copy', name: '上架文案/标题草稿', forStages: ['starting', 'operating'], needs: ['商品资料表'] },
    { id: 'diagnosis', name: '经营诊断与建议', forStages: ['operating', 'struggling'], needs: ['经营时长', '访客与订单概况', '流量来源'] },
    { id: 'general-draft', name: '通用草稿(通知/话术/清单)', forStages: ['exploring', 'starting', 'operating', 'struggling'], needs: ['草稿主题'] },
  ],
  profileRequirements: {
    note: '商品资料6字段仅在用户明确要上架、或已有具体商品时才收集;想法期绝不追问',
    fields: ['productName 商品名', 'category 类目', 'price 价格带', 'specs 规格', 'sellingPoints 卖点', 'notes 备注'],
  },
  checkCriteria: [
    '每轮只问一两个真正影响下一步的问题，已知信息不重复问',
    '用户不知道答案时给选项、建议和取舍，不卡住',
    '用户推测(AI也是)不能写成已确认事实;预算数字除非用户明确批准，否则只是讨论',
    '不编销量、转化率等数据;没有依据就直说不知道',
    '涉及发布/调价/支付/删除/对外发送:可以讨论、可以写草稿，但必须说明自己没有操作权限',
    '能先回答或提供帮助，就不要只连续提问',
  ],
};
