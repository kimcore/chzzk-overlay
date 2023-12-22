"use client"

import {useEffect} from "react"
import {useSearchParams} from "next/navigation"
import {clsx} from "clsx"
import {ChatCmd} from "chzzk"

const colors = ["#ECA843", "#EEA05D", "#EA723D", "#EAA35F", "#E98158", "#E97F58", "#E76D53", "#E66D5F", "#E56B79", "#E16490", "#E481AE", "#E68199", "#DC5E9A", "#E16CB5", "#D25FAC", "#D263AE", "#D66CB4", "#D071B6", "#BA82BE", "#AF71B5", "#A96BB2", "#905FAA", "#B38BC2", "#9D78B8", "#8D7AB8", "#7F68AE", "#9F99C8", "#717DC6", "#5E7DCC", "#5A90C0", "#628DCC", "#7994D0", "#81A1CA", "#ADD2DE", "#80BDD3", "#83C5D6", "#8BC8CB", "#91CBC6", "#83C3BB", "#7DBFB2", "#AAD6C2", "#84C194", "#B3DBB4", "#92C896", "#94C994", "#9FCE8E", "#A6D293", "#ABD373", "#BFDE73", "#CCE57D"]

const emojiRegex = /{:([a-zA-Z0-9_]+):}/g

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))

}

export default function ChatBox({chatChannelId, accessToken}) {
    const searchParams = useSearchParams()
    const small = searchParams.has("small")

    const defaults = {
        cid: chatChannelId,
        svcid: "game",
        ver: "2"
    }

    function appendChat({nickname, badges, color, emojis, message}) {
        const elem = document.createElement("div")
        elem.setAttribute("data-from", nickname)

        const meta = document.createElement("span")
        meta.className = "meta"
        meta.style.color = typeof color == "number" ? colors[color] : color

        badges.forEach(badge => {
            const img = document.createElement("img")
            img.className = "badge"
            img.alt = badge.name
            img.src = badge.src
            meta.appendChild(img)
        })

        const name = document.createElement("span")
        name.className = "name"
        name.innerText = nickname
        meta.appendChild(name)

        const colon = document.createElement("span")
        colon.className = "colon"
        colon.innerText = ":"
        meta.appendChild(colon)

        elem.appendChild(meta)

        const msg = document.createElement("span")
        msg.className = "message"

        const match = message.match(emojiRegex)

        if (match) {
            message.split(emojiRegex).forEach((part, i) => {
                if (i % 2 == 0) {
                    msg.appendChild(document.createTextNode(part))
                } else {
                    const src = emojis[part]
                    const emoteWrap = document.createElement("span")
                    emoteWrap.className = "emote_wrap"
                    const emote = document.createElement("img")
                    emote.className = "emoticon"
                    emote.alt = `{:${part}:}`
                    emote.src = src
                    emoteWrap.appendChild(emote)
                    msg.appendChild(emoteWrap)
                }
            })
        } else {
            msg.innerText = message
        }

        elem.appendChild(msg)

        const log = document.getElementById("log")

        log.appendChild(elem)

        if (log.children.length > 50) {
            log.removeChild(log.children[0])
        }

        window.scrollTo(0, document.body.scrollHeight)
    }

    function onChat(chat) {
        if ((chat['msgStatusType'] || chat['messageStatusType']) == "HIDDEN") return

        const nickname = chat.profile.nickname
        const badge = chat.profile.badge ? {
            name: chat.profile.title.name, src: chat.profile.badge.imageUrl
        } : null
        const badges = (badge ? [badge] : []).concat(
            chat.profile.activityBadges
                ?.filter(badge => badge.activated)
                ?.map(badge => ({name: badge.title, src: badge.imageUrl})) ?? []
        )
        const color = chat.profile.title?.color ?? (chat.profile.userIdHash + chatChannelId).split("")
            .map(c => c.charCodeAt(0))
            .reduce((a, b) => a + b, 0) % colors.length
        const emojis = chat.extras?.emojis || {}
        const message = chat.message

        appendChat({
            nickname,
            badges,
            color,
            emojis,
            message
        })
    }

    async function onMessage(event: MessageEvent) {
        const json = JSON.parse(event.data)

        switch (json.cmd) {
            case ChatCmd.PING:
                this.send(JSON.stringify({
                    cmd: ChatCmd.PONG,
                    tid: json.tid
                }))
                break
            case ChatCmd.CONNECTED:
                const sid = json.bdy.sid
                this.send(JSON.stringify({
                    bdy: {recentMessageCount: 50},
                    cmd: ChatCmd.REQUEST_RECENT_CHAT,
                    sid,
                    tid: 2,
                    ...defaults
                }))
                break
            case ChatCmd.RECENT_CHAT:
            case ChatCmd.CHAT:
                const isRecent = json.cmd == ChatCmd.RECENT_CHAT
                const chats = (isRecent ? json['bdy']['messageList'] : json['bdy'])
                    .filter(chat => (chat['msgTypeCode'] || chat['messageTypeCode']) == 1)

                for (let i = 0; i < chats.length; i++) {
                    const chat = chats[i]
                    const profile = JSON.parse(chat['profile'])
                    const extras = JSON.parse(chat['extras'])

                    if (!isRecent) {
                        await sleep(i * 75)
                    }

                    onChat({
                        profile,
                        extras,
                        message: chat['msg'] || chat['content'],
                    })
                }

                break
        }
    }

    function connectChzzk() {
        const ws = new WebSocket("wss://kr-ss1.chat.naver.com/chat")

        ws.onopen = () => {
            ws.send(JSON.stringify({
                bdy: {
                    accTkn: accessToken,
                    auth: "READ",
                    devType: 2001,
                    uid: null
                },
                cmd: ChatCmd.CONNECT,
                tid: 1,
                ...defaults
            }))
        }

        ws.onclose = () => {
            setTimeout(() => {
                connectChzzk()
            }, 1000)
        }

        ws.onmessage = onMessage
    }

    useEffect(() => {
        // requires obs 30.0.1+
        window.addEventListener("obsStreamingStarted", () => {
            window.location.reload()
        })
        connectChzzk()
    }, [])

    return (
        <div id="log" className={clsx(small && "small")}/>
    )
}